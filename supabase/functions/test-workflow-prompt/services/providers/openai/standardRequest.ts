
import { updatePromptRunWithResult } from "../../../database/prompt-runs.ts";
import { updatePromptRunMetrics } from "../../../database/tool-logs.ts";
import { calculateCost } from "./costCalculator.ts";
import { extractJsonFromResponse } from "../../../utils.ts";
import { createActionRecord } from "../../../database/actions.ts";

export async function processStandardRequest(
  prompt: string,
  model: string,
  supabase: any,
  promptRunId: string,
  projectId?: string
) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Log completion metrics
    if (data.usage) {
      await updatePromptRunMetrics(supabase, promptRunId, {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
        usd_cost: calculateCost(model, data.usage)
      });
    }

    await updatePromptRunWithResult(supabase, promptRunId, aiResponse);
    
    // Check if the response is JSON and try to extract action data
    const result = { result: aiResponse };
    
    // Only attempt to parse and create action records if we have a project ID
    if (projectId) {
      try {
        // Try to parse the JSON response
        const jsonData = extractJsonFromResponse(aiResponse);
        
        if (jsonData && typeof jsonData === 'object') {
          console.log("Successfully parsed JSON response:", JSON.stringify(jsonData).substring(0, 200) + "...");
          
          // Check if the parsed JSON indicates an action is needed
          if (jsonData.decision === "ACTION_NEEDED") {
            console.log("Action needed detected in standard request JSON response");
            
            // Create an action record with the parsed data
            const actionResult = await createActionRecord(
              supabase,
              promptRunId,
              projectId,
              jsonData
            );
            
            // Add the action record ID to the result
            if (actionResult && actionResult.action_record_id) {
              result.actionRecordId = actionResult.action_record_id;
              console.log(`Created action record ${result.actionRecordId} from standard request`);
            }
            
            // Check if a reminder was set
            if (jsonData.days_until_check || jsonData.reminder_days) {
              result.reminderSet = true;
              result.nextCheckDateInfo = {
                days: jsonData.days_until_check || jsonData.reminder_days,
                reason: jsonData.check_reason || jsonData.reason || "Follow up"
              };
            }
          } 
          else if (jsonData.decision === "SET_FUTURE_REMINDER") {
            console.log("Future reminder requested in standard request JSON response");
            
            // Create action record for the reminder
            const reminderResult = await createActionRecord(
              supabase,
              promptRunId,
              projectId,
              jsonData
            );
            
            // Add the data to the result
            result.reminderSet = true;
            result.nextCheckDateInfo = {
              days: jsonData.days_until_check || 7,
              reason: jsonData.check_reason || jsonData.reason || "Follow up"
            };
          }
        }
      } catch (parseError) {
        // Just log the error and continue; we'll return the raw response
        console.error("Error parsing or handling JSON response:", parseError);
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error in standard OpenAI request:", error);
    throw error;
  }
}
