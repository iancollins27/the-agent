
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
    
    // Parse the decision from the AI response
    // If decision wasn't explicitly provided, default to ACTION_NEEDED since this is the create_action_record tool
    const decision = actionData.decision || "ACTION_NEEDED";
    
    // Only create an action record if the decision is ACTION_NEEDED
    if (decision === "ACTION_NEEDED" || !decision) {
      // Prepare data for action creation
      const actionRequest = {
        ...actionData,
        decision: "ACTION_NEEDED" // Ensure decision is properly set
      };
      
      return await handleActionNeeded(supabase, promptRunId, projectId, actionRequest);
    } 
    // Handle SET_FUTURE_REMINDER action type specially
    else if (decision === "SET_FUTURE_REMINDER" || actionData.action_type === "set_future_reminder") {
      return await handleFutureReminder(supabase, promptRunId, projectId, actionData);
    } else {
      console.log("No action needed based on AI decision:", decision);
      // Return a valid object even when no action is taken
      return { status: "no_action", message: `No action needed: ${decision || "unknown decision"}` };
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
