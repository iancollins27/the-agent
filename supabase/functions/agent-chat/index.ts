import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./utils/cors.ts";
import { getChatSystemPrompt } from "./mcp-system-prompts.ts";
import { getToolNames, filterTools, getToolDefinitions, getFormattedToolDefinitions } from "./tools/toolRegistry.ts";
import { replaceVariables } from "./utils/stringUtils.ts";
import { executeToolCall } from "./tools/toolExecutor.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

interface ChatRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  projectId?: string;
  projectData?: any;
  customPrompt?: string;
  availableTools?: string[];
  getToolDefinitions?: boolean; // Special flag to request tool definitions
  userId?: string; // User ID for authorization
}

// Helper function to get user profile for authorization
async function getUserProfile(supabase: any, userId: string) {
  if (!userId) {
    console.log("No user ID provided to getUserProfile");
    return null;
  }
  
  try {
    console.log(`Looking up profile for user ID: ${userId}`);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    if (!data) {
      console.log(`No profile found for user ID: ${userId}`);
      return null;
    }
    
    console.log(`Found user profile for ${userId}: company_id=${data.company_id || 'none'}`);
    return data;
  } catch (error) {
    console.error('Exception in getUserProfile:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  // Parse request body
  let payload: ChatRequest;
  try {
    payload = await req.json();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  try {
    // Determine authentication method
    let supabase;
    let userProfile = null;
    let companyId = null;

    // Check if we have a userId (contact_id) - this indicates SMS/phone auth
    if (payload.userId) {
      console.log(`Request received with contact_id: ${payload.userId}`);
      
      // Create user-scoped client for SMS users
      const { data: userToken } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        .from('user_tokens')
        .select('*, contacts(*)')
        .eq('contact_id', payload.userId)
        .gt('expires_at', new Date().toISOString())
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (userToken) {
        // Create user-scoped supabase client
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: {
              'Authorization': `Bearer ${userToken.token_hash}`
            }
          }
        });
        
        // Set user context from contact
        userProfile = {
          id: userToken.contact_id,
          company_id: userToken.contacts?.company_id,
          profile_fname: userToken.contacts?.full_name?.split(' ')[0],
          profile_lname: userToken.contacts?.full_name?.split(' ').slice(1).join(' '),
          role: userToken.contacts?.role
        };
        companyId = userToken.contacts?.company_id;
        
        console.log(`SMS user authenticated - contact: ${userProfile.id}, company: ${companyId}`);
      } else {
        console.log(`No valid token found for contact_id: ${payload.userId}`);
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }
    } else {
      // Web user authentication (existing flow)
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Get user profile from web auth
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        // Parse JWT to get user info (simplified)
        try {
          const payload_claims = JSON.parse(atob(token.split('.')[1]));
          if (payload_claims.sub) {
            userProfile = await getUserProfile(supabase, payload_claims.sub);
            companyId = userProfile?.company_id;
            console.log(`Web user authenticated - user: ${payload_claims.sub}, company: ${companyId}`);
          }
        } catch (e) {
          console.log('Could not parse web auth token');
        }
      }
    }

    // Special case: If getToolDefinitions flag is set, return the available tool definitions
    if (payload.getToolDefinitions) {
      console.log("Tool definitions requested");
      const toolDefinitions = getToolDefinitions();
      return new Response(
        JSON.stringify({ toolDefinitions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Get available tools based on the request or use all tools by default
    const requestedToolNames = payload.availableTools && payload.availableTools.length > 0 
      ? payload.availableTools 
      : getToolNames();
    
    const toolDefinitions = filterTools(requestedToolNames);

    console.log(`Available tools for this request: ${JSON.stringify(requestedToolNames)}`);
    console.log(`Filtered tool definitions: ${JSON.stringify(toolDefinitions.map(t => t.function.name))}`);
    
    // Format tools for variable replacement in prompt
    const formattedToolsInfo = toolDefinitions.length > 0 
      ? toolDefinitions.map(tool => `${tool.function.name} (${tool.function.description})`).join(", ")
      : "No tools available";
    
    // Setup context data for variable replacement
    const contextData = {
      projectData: payload.projectData || {},
      current_date: new Date().toISOString().split('T')[0],
      available_tools: formattedToolsInfo,
      user_question: payload.messages[payload.messages.length - 1]?.content || "",
      company_id: companyId, // Add company ID to context data
      user_name: userProfile ? `${userProfile.profile_fname || ''} ${userProfile.profile_lname || ''}`.trim() : "Anonymous" // Add user name if available
    };

    // Get the appropriate system prompt (either custom or default)
    let systemPrompt: string;
    
    if (payload.customPrompt) {
      // Replace variables in the custom prompt
      systemPrompt = replaceVariables(payload.customPrompt, contextData);
    } else {
      // Use default prompt with tools if available
      systemPrompt = getChatSystemPrompt(requestedToolNames, contextData);
    }

    // Create system message with the formatted prompt
    const systemMessage = {
      role: "system",
      content: systemPrompt
    };

    // Replace system message if it exists, otherwise add it
    const hasSystemMessage = payload.messages.some(msg => msg.role === "system");
    let messages = hasSystemMessage 
      ? payload.messages.map(msg => msg.role === "system" ? systemMessage : msg)
      : [systemMessage, ...payload.messages];

    // Log access for audit
    if (userProfile) {
      await supabase
        .from('audit_log')
        .insert({
          contact_id: payload.userId || null,
          user_id: !payload.userId ? userProfile.id : null,
          company_id: companyId,
          action: 'agent_chat_request',
          resource_type: 'ai_interaction',
          details: { 
            tool_count: requestedToolNames.length,
            message_count: payload.messages.length
          }
        });
    }

    // Basic request to OpenAI
    console.log("Sending OpenAI request with tools:", JSON.stringify(toolDefinitions.map(t => t.function.name)));

    const openAIRequestBody: any = {
      model: "gpt-4o",
      messages,
      tools: toolDefinitions // Always set the tools property, even if it's an empty array
    };

    let assistantMessage;
    
    // Loop until we get a response with no tool calls
    while (true) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(openAIRequestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      assistantMessage = data.choices[0].message;
      
      // If there are no tool calls, we're done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        break;
      }
      
      console.log(`Processing ${assistantMessage.tool_calls.length} tool calls`);
      
      // Add the assistant message with tool calls to the conversation
      messages.push(assistantMessage);
      
      // Process each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const { name, arguments: argsJson } = toolCall.function;
        const args = JSON.parse(argsJson);
        
        console.log(`Executing tool ${name} with args: ${argsJson}`);
        console.log(`Security context for tool execution - user: ${userProfile?.id || 'anonymous'}, company: ${companyId || 'none'}`);
        
        try {
          // Use the toolExecutor instead of direct imports to handle the name mapping
          // Pass userProfile and companyId for authorization
          const toolResult = await executeToolCall(
            supabase, 
            name, 
            args, 
            userProfile, 
            companyId
          );
          
          // Log tool usage
          await supabase
            .from('audit_log')
            .insert({
              contact_id: payload.userId || null,
              user_id: !payload.userId ? userProfile?.id : null,
              company_id: companyId,
              action: 'tool_execution',
              resource_type: 'ai_tool',
              details: { 
                tool_name: name,
                success: toolResult.status === 'success'
              }
            });
          
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
          
          console.log(`Tool ${name} execution completed`);
        } catch (toolError) {
          console.error(`Error executing tool ${name}:`, toolError);
          
          // Log tool error
          await supabase
            .from('audit_log')
            .insert({
              contact_id: payload.userId || null,
              user_id: !payload.userId ? userProfile?.id : null,
              company_id: companyId,
              action: 'tool_execution_error',
              resource_type: 'ai_tool',
              details: { 
                tool_name: name,
                error: toolError.message
              }
            });
          
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              status: "error",
              error: toolError.message || "Unknown error",
              message: `Error executing tool ${name}: ${toolError.message || "Unknown error"}`
            })
          });
        }
      }
      
      // Update OpenAI request body with new messages
      openAIRequestBody.messages = messages;
    }

    return new Response(JSON.stringify({ 
      choices: [{ message: assistantMessage }]
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in agent-chat function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

/**
 * Generates an embedding vector for the given text
 */
async function generateEmbedding(text: string, context: any): Promise<number[] | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`OpenAI embeddings API error: ${error}`);
      return null;
    }
    
    const data = await response.json();
    const embedding = data.data[0].embedding;
    
    // Log just the first few values of the embedding for debugging
    console.log(`Generated embedding for query, first 5 values: [ ${embedding.slice(0, 5).join(', ')} ]`);
    
    return embedding;
  } catch (error) {
    console.error(`Error generating embedding: ${error.message}`);
    return null;
  }
}
