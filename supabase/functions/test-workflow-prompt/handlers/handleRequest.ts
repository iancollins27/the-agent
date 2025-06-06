
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from '../utils/cors.ts';
import { handleEscalation } from "../database/handlers/escalationHandler.ts";
import { executeMCPRequest } from "../services/mcpService.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function logWithTime(message: string) {
  const now = new Date();
  const timeString = now.toISOString();
  console.log(`[${timeString}] ${message}`);
}

export async function handleRequest(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    logWithTime('Starting test-workflow-prompt function, connecting to Supabase at: ' + 
      (supabaseUrl?.substring(0, 30) + '...'));
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const requestBody = await req.json();
    
    // Check if this is an escalation processing request (internal call)
    if (requestBody.action_type === 'process_escalation') {
      console.log("Processing internal escalation request:", requestBody);
      
      const { action_record_id, project_id } = requestBody;
      
      if (!action_record_id || !project_id) {
        return new Response(
          JSON.stringify({
            status: "error",
            error: "Missing action_record_id or project_id for escalation processing"
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Call the escalation handler directly with service role permissions
      const escalationResult = await handleEscalation(
        supabase,
        null, // No prompt run ID for direct escalation processing
        project_id,
        { 
          reason: "Direct escalation processing",
          description: "Processing escalation from action record"
        }
      );

      return new Response(
        JSON.stringify(escalationResult),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // For all other requests, require user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logWithTime('Error: Missing or invalid authorization header for user request');
      return new Response(
        JSON.stringify({ 
          error: 'Missing or invalid authorization header',
          message: 'This endpoint requires authentication'
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Get user profile from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      logWithTime('Error: Invalid user token');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid user token',
          message: 'Authentication failed'
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logWithTime('Error fetching user profile: ' + profileError.message);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch user profile',
          message: profileError.message
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const companyId = userProfile?.company_id || null;
    
    const result = await handlePromptRequest(supabase, requestBody, userProfile, companyId);
    
    logWithTime('Successfully processed request, returning response');
    
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    logWithTime(`Error processing request: ${error.message}`);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
        stack: Deno.env.get('NODE_ENV') === 'development' ? error.stack : undefined
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

async function handlePromptRequest(
  supabase: any,
  requestBody: any,
  userProfile: any,
  companyId: string | null
): Promise<any> {
  try {
    const { prompt, project_id: projectId, prompt_run_id: promptRunId, contextData, promptType, useMCP, aiProvider = 'openai', aiModel = 'gpt-4' } = requestBody;

    console.log("Request body keys:", Object.keys(requestBody));
    console.log("Context data:", contextData ? JSON.stringify(contextData, null, 2) : "No context data");

    if (!prompt || !projectId || !promptRunId) {
      console.error("Missing required parameters - prompt:", !!prompt, "projectId:", !!projectId, "promptRunId:", !!promptRunId);
      return {
        status: "error",
        error: "Missing required parameters: prompt, project_id, or prompt_run_id"
      };
    }

    console.log(`Received prompt: ${prompt.substring(0, 100)}... for project ${projectId}`);

    // Check if we should use MCP based on prompt type or explicit flag
    const shouldUseMCP = useMCP || promptType === 'mcp_orchestrator';
    
    console.log(`MCP decision: useMCP=${useMCP}, promptType=${promptType}, shouldUseMCP=${shouldUseMCP}`);

    // If we should use MCP, route to the MCP service
    if (shouldUseMCP) {
      console.log("Routing to MCP service for processing");
      
      // Log MCP and tools information from context data
      if (contextData) {
        console.log("MCP configuration:", {
          useMCP: contextData.useMCP,
          available_tools: contextData.available_tools,
          tools_count: Array.isArray(contextData.available_tools) ? contextData.available_tools.length : 0,
          promptType: contextData.promptType
        });
      }

      // Route to the MCP service with proper context
      const mcpResult = await executeMCPRequest(
        supabase,
        projectId,
        contextData,
        aiProvider,
        aiModel,
        promptRunId
      );

      return {
        status: "success",
        response: mcpResult.result || mcpResult.output || "MCP processing completed",
        output: mcpResult.result || mcpResult.output || "MCP processing completed",
        finalPrompt: mcpResult.finalPrompt || prompt,
        promptRunId: promptRunId,
        usedMCP: true,
        actionRecordId: mcpResult.actionRecordId,
        humanReviewRequestId: mcpResult.humanReviewRequestId,
        knowledgeResults: mcpResult.knowledgeResults || []
      };
    }

    // For non-MCP requests, use the simple OpenAI flow
    console.log("Using simple OpenAI flow (non-MCP)");

    // Get project details for context
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        project_name,
        summary,
        next_step,
        Address,
        companies(name, id)
      `)
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project data:", projectError);
      return {
        status: "error",
        error: "Failed to fetch project data"
      };
    }

    // Get the company settings
    const { data: companySettings, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', projectData?.companies?.id)
      .single();

    if (companyError) {
      console.error("Error fetching company settings:", companyError);
      return {
        status: "error",
        error: "Failed to fetch company settings"
      };
    }

    // Construct the prompt with project details
    const fullPrompt = `
      You are an AI project manager. Your goal is to help manage roofing and solar projects.
      You have access to project details and can create action records to manage the project.
      
      Project Name: ${projectData.project_name}
      Project Summary: ${projectData.summary}
      Project Next Step: ${projectData.next_step}
      Project Address: ${projectData.Address}
      
      Company Name: ${projectData.companies.name}
      
      ${companySettings?.ai_prompt_context || ''}
      
      Based on the above information, respond to the following prompt:
      ${prompt}
    `;

    // Call the OpenAI API
    const openAiUrl = "https://api.openai.com/v1/chat/completions";
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiApiKey) {
      console.error("OPENAI_API_KEY is not set");
      return {
        status: "error",
        error: "OPENAI_API_KEY is not set"
      };
    }

    const openAiBody = {
      model: aiModel,
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.7,
    };

    const openAiResponse = await fetch(openAiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify(openAiBody),
    });

    const openAiData = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error("OpenAI API error:", openAiData);
      return {
        status: "error",
        error: "OpenAI API error",
        details: openAiData
      };
    }

    const responseText = openAiData.choices[0].message.content;
    console.log(`Received response: ${responseText.substring(0, 100)}...`);

    return {
      status: "success",
      response: responseText,
      output: responseText,
      finalPrompt: fullPrompt,
      promptRunId: promptRunId,
      usedMCP: false
    };
  } catch (error) {
    console.error("Error in handlePromptRequest:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}
