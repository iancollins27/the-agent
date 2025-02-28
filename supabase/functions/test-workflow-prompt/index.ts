
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    const { promptType, promptText, projectId, contextData, previousResults } = await req.json();
    
    console.log(`Testing prompt type: ${promptType} for project ${projectId}`);
    console.log("Context data provided:", contextData);
    
    if (!promptText) {
      throw new Error("Prompt text is required");
    }
    
    // Replace variables in the prompt text with actual values
    // Use contextData for variable replacement
    const finalPrompt = replaceVariables(promptText, contextData);
    
    // Would normally call OpenAI here, but for testing we'll simulate a response
    let result: string;
    
    if (openaiApiKey) {
      // Use OpenAI if we have an API key
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that processes project information and provides relevant outputs based on the request type."
            },
            {
              role: "user",
              content: finalPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });
      
      const data = await response.json();
      result = data.choices?.[0]?.message?.content || "Error: No response from OpenAI";
      
      if (data.error) {
        console.error("OpenAI API error:", data.error);
        result = `Error from OpenAI API: ${data.error.message || data.error}`;
      }
    } else {
      // If we don't have an OpenAI API key, generate mock results
      switch (promptType) {
        case "summary_generation":
          result = `This is a sample summary for a project in the ${contextData.track_name} track. Generated on ${contextData.current_date}.`;
          break;
        case "summary_update":
          result = `Updated summary based on: "${contextData.summary}". Project is in the ${contextData.track_name} track. Last updated on ${contextData.current_date}.`;
          break;
        case "action_detection":
          result = `Based on the summary "${contextData.summary}" for the ${contextData.track_name} track, here are some detected actions:\n1. Schedule a follow-up call\n2. Prepare project materials\n3. Review timeline`;
          break;
        case "action_execution":
          result = `For the action "${contextData.action_description}" on project with summary "${contextData.summary}" in the ${contextData.track_name} track, here are execution steps:\n1. Step one\n2. Step two\n3. Step three`;
          break;
        default:
          result = "Unknown prompt type";
      }
    }
    
    return new Response(
      JSON.stringify({
        finalPrompt,
        result,
        projectId,
        promptType,
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
