
import { logToolCall } from "../../../database/tool-logs.ts";
import { createActionRecord } from "../../../database/actions.ts";
import { requestHumanReview } from "../../../human-service.ts";

export async function processToolCall(supabase: any, toolName: string, args: any, promptRunId: string, projectId: string) {
  const toolCallId = `call_${Math.random().toString(36).substring(2, 15)}`;
  const startTime = Date.now();
  let status = 200;
  let result;
  let argsString;
  
  try {
    // Convert args to string for logging
    try {
      argsString = typeof args === 'string' ? args : JSON.stringify(args);
    } catch (e) {
      argsString = "Error stringifying args";
    }
    
    // Log the tool call before execution
    await logToolCall(supabase, promptRunId, toolName, toolCallId, argsString, "", 0, 0);

    // Process different tool types
    switch (toolName) {
      case "detect_action":
        // Simply return the args as the result for detect_action
        result = { 
          decision: args.decision,
          reason: args.reason,
          priority: args.priority || "medium",
          reminderSet: args.decision === "SET_FUTURE_REMINDER",
          reminderDays: args.days_until_check, 
          status: "success"
        };
        break;
        
      case "create_action_record":
      case "generate_action":
        // Make sure decision is included from detect_action call
        if (args.decision) {
          // Create an action record with the decision
          result = await createActionRecord(supabase, promptRunId, projectId, args);
        } else {
          console.warn("Missing decision in create_action_record call");
          // Attempt to call createActionRecord anyway, the function should handle missing decision
          result = await createActionRecord(supabase, promptRunId, projectId, args);
        }
        break;
        
      case "knowledge_base_lookup":
        // Knowledge lookup is disabled for now
        result = { 
          status: "error",
          error: "Knowledge base lookup is currently disabled",
          results: []
        };
        break;
        
      default:
        status = 400;
        result = { 
          status: "error",
          error: `Unknown tool: ${toolName}`
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    status = 500;
    result = {
      status: "error",
      error: error.message || "Unknown error"
    };
  }

  // Calculate duration
  const duration = Date.now() - startTime;
  
  // Log the result
  try {
    const resultString = typeof result === 'string' ? result : JSON.stringify(result);
    await logToolCall(
      supabase, 
      promptRunId, 
      toolName, 
      toolCallId, 
      argsString || "", 
      resultString, 
      status, 
      duration
    );
    console.log(`Logged tool call ${toolName} with ID ${toolCallId}`);
  } catch (logError) {
    console.error("Error logging tool call:", logError);
  }

  return result;
}
