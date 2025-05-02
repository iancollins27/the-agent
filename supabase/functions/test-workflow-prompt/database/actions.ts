
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleActionNeeded } from "./handlers/actionDecisionHandler.ts";
import { handleFutureReminder } from "./handlers/reminderHandler.ts";

/**
 * Creates an action record from action detection+execution results
 * Improved error handling to ensure a consistent return format
 */
export async function createActionRecord(
  supabase: SupabaseClient,
  promptRunId: string, 
  projectId: string, 
  actionData: any
) {
  try {
    console.log("Creating action record with data:", JSON.stringify(actionData, null, 2));
    
    if (!projectId) {
      console.error("Error: Missing projectId for action record");
      return { status: "error", error: "Missing projectId" };
    }
    
    if (!promptRunId) {
      console.error("Error: Missing promptRunId for action record");
      return { status: "error", error: "Missing promptRunId" };
    }
    
    if (!actionData) {
      console.error("Error: Missing actionData for action record");
      return { status: "error", error: "Missing actionData" };
    }
    
    // Get the action type
    const actionType = actionData.action_type;
    if (!actionType) {
      console.error("Error: Missing action_type in action record data");
      return { status: "error", error: "Missing action_type" };
    }
    
    // Handle based on action type
    if (actionType === "set_future_reminder") {
      return await handleFutureReminder(supabase, promptRunId, projectId, actionData);
    } 
    else {
      // For all other action types (message, data_update, human_in_loop, knowledge_query)
      return await handleActionNeeded(supabase, promptRunId, projectId, actionData);
    }
  } catch (error) {
    console.error("Error creating action record:", error);
    // Return structured error object with status field
    return { 
      status: "error", 
      error: error.message || "Unknown error in createActionRecord" 
    };
  }
}

/**
 * Creates a reminder record with specified check-in days
 * This is a convenience function for creating reminders directly
 */
export async function createReminder(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  daysUntilCheck: number,
  checkReason: string
) {
  return await handleFutureReminder(supabase, promptRunId, projectId, {
    days_until_check: daysUntilCheck,
    check_reason: checkReason
  });
}
