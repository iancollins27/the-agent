
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
const claudeApiKey = Deno.env.get("CLAUDE_API_KEY") || "";
const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replaceVariables(text: string, variables: Record<string, string>): string {
  let processedText = text;
  
  // Log the variables available for replacement
  console.log("Variables for replacement:", variables);
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    processedText = processedText.replace(regex, value);
  }
  
  // Log the final text after variable replacement
  console.log("Text after variable replacement:", processedText);
  
  return processedText;
}

async function callOpenAI(prompt: string, model: string = "gpt-4o-mini") {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that processes project information and provides relevant outputs based on the request type."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("OpenAI API error:", data.error);
    throw new Error(`OpenAI API error: ${data.error.message || data.error}`);
  }
  
  return data.choices?.[0]?.message?.content || "Error: No response from OpenAI";
}

async function callClaude(prompt: string, model: string = "claude-3-haiku-20240307") {
  if (!claudeApiKey) {
    throw new Error("Claude API key is not set");
  }
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": claudeApiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("Claude API error:", data.error);
    throw new Error(`Claude API error: ${data.error.message || data.error}`);
  }
  
  return data.content?.[0]?.text || "Error: No response from Claude";
}

async function callDeepseek(prompt: string, model: string = "deepseek-chat") {
  if (!deepseekApiKey) {
    throw new Error("DeepSeek API key is not set");
  }
  
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that processes project information and provides relevant outputs based on the request type."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });
  
  const data = await response.json();
  if (data.error) {
    console.error("DeepSeek API error:", data.error);
    throw new Error(`DeepSeek API error: ${data.error.message || data.error}`);
  }
  
  return data.choices?.[0]?.message?.content || "Error: No response from DeepSeek";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { promptType, promptText, projectId, contextData, aiProvider, aiModel } = await req.json();
    
    console.log(`Testing prompt type: ${promptType} for project ${projectId}`);
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
    console.log("Context data provided:", contextData);
    console.log("Milestone instructions:", contextData.milestone_instructions);
    
    if (!promptText) {
      throw new Error("Prompt text is required");
    }
    
    // Replace variables in the prompt text with actual values
    const finalPrompt = replaceVariables(promptText, contextData);
    
    let result: string;
    
    try {
      // Call the appropriate AI provider based on the aiProvider parameter
      switch (aiProvider) {
        case "openai":
          if (openaiApiKey) {
            result = await callOpenAI(finalPrompt, aiModel);
          } else {
            throw new Error("OpenAI API key not configured");
          }
          break;
        case "claude":
          if (claudeApiKey) {
            result = await callClaude(finalPrompt, aiModel);
          } else {
            throw new Error("Claude API key not configured");
          }
          break;
        case "deepseek":
          if (deepseekApiKey) {
            result = await callDeepseek(finalPrompt, aiModel);
          } else {
            throw new Error("DeepSeek API key not configured");
          }
          break;
        default:
          // If no valid AI provider is specified or API key is missing, generate mock results
          result = generateMockResult(promptType, contextData);
      }
    } catch (error) {
      console.error(`Error calling AI provider (${aiProvider}):`, error);
      // Fall back to mock results if there's an error
      result = generateMockResult(promptType, contextData);
      result += `\n\nNote: There was an error using the ${aiProvider} API: ${error.message}`;
    }
    
    return new Response(
      JSON.stringify({
        finalPrompt,
        result,
        projectId,
        promptType,
        aiProvider,
        aiModel
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in test-workflow-prompt function:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});

function generateMockResult(promptType: string, contextData: Record<string, string>): string {
  switch (promptType) {
    case "summary_generation":
      return `This is a sample summary for a project in the ${contextData.track_name} track. Generated on ${contextData.current_date}. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "summary_update":
      return `Updated summary based on: "${contextData.summary}". Project is in the ${contextData.track_name} track. Last updated on ${contextData.current_date}. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "action_detection":
      return `Based on the summary "${contextData.summary}" for the ${contextData.track_name} track, here are some detected actions:\n1. Schedule a follow-up call\n2. Prepare project materials\n3. Review timeline. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "action_execution":
      return `For the action "${contextData.action_description}" on project with summary "${contextData.summary}" in the ${contextData.track_name} track, here are execution steps:\n1. Step one\n2. Step two\n3. Step three. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    default:
      return "Unknown prompt type";
  }
}
