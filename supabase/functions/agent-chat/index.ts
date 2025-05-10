
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "./utils/cors.ts";
import { getChatSystemPrompt } from "./mcp-system-prompts.ts";
import { getToolNames, filterTools } from "./tools/toolRegistry.ts";
import { replaceVariables } from "./utils/stringUtils.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

interface ChatRequest {
  messages: Array<{
    role: string;
    content: string;
  }>;
  projectId?: string;
  projectData?: any;
  customPrompt?: string;
  availableTools?: string[];
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
    // Setup context data for variable replacement
    const contextData = {
      projectData: payload.projectData || {},
      current_date: new Date().toISOString().split('T')[0],
      available_tools: payload.availableTools?.join(", ") || "No tools available",
      user_question: payload.messages[payload.messages.length - 1]?.content || ""
    };

    // Get the appropriate system prompt (either custom or default)
    let systemPrompt: string;
    
    if (payload.customPrompt) {
      // Replace variables in the custom prompt
      systemPrompt = replaceVariables(payload.customPrompt, contextData);
    } else {
      // Use default prompt with tools if available
      systemPrompt = getChatSystemPrompt(payload.availableTools || [], contextData);
    }

    // Create system message with the formatted prompt
    const systemMessage = {
      role: "system",
      content: systemPrompt
    };

    // Replace system message if it exists, otherwise add it
    const hasSystemMessage = payload.messages.some(msg => msg.role === "system");
    const messages = hasSystemMessage 
      ? payload.messages.map(msg => msg.role === "system" ? systemMessage : msg)
      : [systemMessage, ...payload.messages];

    // Get appropriate tools for the chat model
    const toolDefinitions = payload.availableTools && payload.availableTools.length > 0 
      ? filterTools(payload.availableTools) 
      : [];

    // Basic request to OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
