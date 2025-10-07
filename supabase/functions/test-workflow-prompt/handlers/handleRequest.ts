
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from '../utils/cors.ts';
import { handleEscalation } from "../database/handlers/escalationHandler.ts";
import { executeMCPRequest } from "../services/mcpService.ts";
import { logPromptRun } from "../database/prompt-runs.ts";

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
    
    // Log request details for debugging
    logWithTime(`Request method: ${req.method}`);
    logWithTime(`Request headers: ${JSON.stringify(Object.fromEntries(req.headers.entries()))}`);
    logWithTime(`Request body keys: ${Object.keys(requestBody).join(', ')}`);
    logWithTime(`Internal service call flag: ${requestBody.internalServiceCall}`);
    logWithTime(`Initiated by: ${requestBody.initiatedBy || 'unknown'}`);
    
    // Check if this is an escalation processing request (internal call)
    if (requestBody.action_type === 'process_escalation') {
      logWithTime("Processing internal escalation request");
      
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

    // Check if this is an internal service call (bypass user authentication)
    if (requestBody.internalServiceCall) {
      logWithTime("Processing internal service call, bypassing user authentication");
      
      const result = await handlePromptRequest(
        supabase, 
        requestBody, 
        null, // No user profile for internal calls
        null  // No company ID for internal calls
      );
      
      logWithTime('Successfully processed internal service request');
      
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
    logWithTime(`Error stack: ${error.stack}`);
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
    // FIXED: Accept both parameter naming conventions
    const prompt = requestBody.prompt || requestBody.promptText;
    const projectId = requestBody.project_id || requestBody.projectId;
    const promptRunId = requestBody.prompt_run_id || requestBody.promptRunId || requestBody.workflowPromptId;
    const contextData = requestBody.contextData || {};
    const promptType = requestBody.promptType;
    const useMCP = requestBody.useMCP;
    const aiProvider = requestBody.aiProvider || 'openai';
    const aiModel = requestBody.aiModel || 'gpt-4';

    logWithTime("FIXED: Using normalized parameters");
    logWithTime("Request body keys: " + Object.keys(requestBody).join(', '));
    logWithTime("Normalized parameters - prompt: " + !!prompt + ", projectId: " + !!projectId + ", promptRunId: " + !!promptRunId);
    logWithTime("Context data: " + (contextData ? JSON.stringify(contextData, null, 2) : "No context data"));

    if (!prompt || !projectId || !promptRunId) {
      logWithTime("VALIDATION ERROR - Missing required parameters - prompt: " + !!prompt + ", projectId: " + !!projectId + ", promptRunId: " + !!promptRunId);
      return {
        status: "error",
        error: "Missing required parameters: prompt/promptText, project_id/projectId, or prompt_run_id/promptRunId/workflowPromptId"
      };
    }

    logWithTime(`Received prompt: ${prompt.substring(0, 100)}... for project ${projectId}`);

    // CRITICAL FIX: Create the prompt run record in the database FIRST
    // This ensures the record exists before any tool calls are made
    logWithTime(`Creating prompt run record in database with ID: ${promptRunId}`);
    
    try {
      const dbPromptRunId = await logPromptRun(
        supabase,
        projectId,
        promptRunId, // Use the provided ID as workflow_prompt_id 
        prompt,
        aiProvider,
        aiModel,
        requestBody.internalServiceCall ? 'internal-service' : 'test-runner' // Mark source appropriately
      );
      
      if (!dbPromptRunId) {
        throw new Error("Failed to create prompt run record in database");
      }
      
      logWithTime(`Successfully created prompt run record with database ID: ${dbPromptRunId}`);
      
      // Use the database ID for all subsequent operations
      const actualPromptRunId = dbPromptRunId;
      
      // Check if we should use MCP based on prompt type or explicit flag
      const shouldUseMCP = useMCP || promptType === 'mcp_orchestrator';
      
      logWithTime(`MCP decision: useMCP=${useMCP}, promptType=${promptType}, shouldUseMCP=${shouldUseMCP}`);

      // If we should use MCP, route to the MCP service
      if (shouldUseMCP) {
        logWithTime("ROUTING TO MCP SERVICE for processing");
        
        // Log MCP and tools information from context data
        if (contextData) {
          logWithTime("MCP configuration: " + JSON.stringify({
            useMCP: contextData.useMCP,
            available_tools: contextData.available_tools,
            tools_count: Array.isArray(contextData.available_tools) ? contextData.available_tools.length : 0,
            promptType: contextData.promptType
          }));
        }

        // Route to the MCP service with proper context and the ACTUAL database prompt run ID
        const mcpResult = await executeMCPRequest(
          supabase,
          projectId,
          contextData,
          aiProvider,
          aiModel,
          actualPromptRunId // Use the actual database ID here
        );

        logWithTime("MCP RESULT: " + JSON.stringify({
          hasResult: !!mcpResult.result,
          hasOutput: !!mcpResult.output,
          actionRecordId: mcpResult.actionRecordId,
          toolOutputsCount: mcpResult.toolOutputs?.length || 0
        }));

        return {
          status: "success",
          response: mcpResult.result || mcpResult.output || "MCP processing completed",
          output: mcpResult.result || mcpResult.output || "MCP processing completed",
          finalPrompt: mcpResult.finalPrompt || prompt,
          promptRunId: actualPromptRunId, // Return the actual database ID
          usedMCP: true,
          actionRecordId: mcpResult.actionRecordId,
          humanReviewRequestId: mcpResult.humanReviewRequestId,
          knowledgeResults: mcpResult.knowledgeResults || []
        };
      }

      // For non-MCP requests, use the simple OpenAI flow
      logWithTime("Using simple OpenAI flow (non-MCP)");

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
      max_completion_tokens: 2000,
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
      
    } catch (promptRunError) {
      logWithTime("Error creating prompt run record: " + promptRunError.message);
      return {
        status: "error",
        error: `Failed to create prompt run record: ${promptRunError.message}`
      };
    }

    
  } catch (error) {
    logWithTime("Error in handlePromptRequest: " + error.message);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}
