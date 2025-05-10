
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./utils/cors.ts";
import { getChatSystemPrompt } from "./mcp-system-prompts.ts";
import { getToolNames, filterTools, getToolDefinitions, getFormattedToolDefinitions } from "./tools/toolRegistry.ts";
import { replaceVariables } from "./utils/stringUtils.ts";
import { executeToolCall } from "./tools/toolExecutor.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
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
    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
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
      user_question: payload.messages[payload.messages.length - 1]?.content || ""
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
        
        try {
          // Use the toolExecutor instead of direct imports to handle the name mapping
          const toolResult = await executeToolCall(supabase, name, args, null, payload.projectData?.company_id);
          
          // Add the tool response to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
          
          console.log(`Tool ${name} execution completed`);
        } catch (toolError) {
          console.error(`Error executing tool ${name}:`, toolError);
          
          // Add error response to messages
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
