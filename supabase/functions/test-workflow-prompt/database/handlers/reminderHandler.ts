
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { setProjectNextCheckDate } from "../projects.ts";

/**
 * Handle SET_FUTURE_REMINDER decision type with improved error handling
 */
export async function handleFutureReminder(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
  try {
    // Calculate the next check date
    const daysToAdd = actionData.days_until_check || 7; // Default to 7 days if not specified
    const nextCheckDate = await setProjectNextCheckDate(supabase, projectId, daysToAdd);
    
    if (!nextCheckDate) {
      console.error("Failed to set next check date for project", projectId);
      return { 
        status: "error", 
        error: "Failed to set next check date" 
      };
    }

    // Calculate the reminder date (same as next check date)
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + daysToAdd);
    
    // Create an action record to document the reminder setting
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'set_future_reminder',
        action_payload: {
          days_until_check: daysToAdd,
          check_reason: actionData.check_reason || 'Follow-up check',
          description: `Set reminder to check in ${daysToAdd} days: ${actionData.check_reason || 'Follow-up check'}`,
          reminder_description: `Reminder set for ${daysToAdd} day${daysToAdd === 1 ? '' : 's'} from now`,
          scheduled_date: reminderDate.toISOString()
        },
        reminder_date: reminderDate.toISOString(), // Ensure this is always set
        requires_approval: false,
        status: 'executed',
        executed_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error creating reminder action record:", error);
      return { 
        status: "error", 
        error: `Failed to create reminder action record: ${error.message}` 
      };
    }
    
    console.log("Reminder action record created successfully:", data);
    console.log(`Project ${projectId} scheduled for check on ${reminderDate.toISOString()}`);
    
    return { 
      status: "success", 
      action_record_id: data.id,
      reminderSet: true,
      reminderDays: daysToAdd,
      reminderDate: reminderDate.toISOString(),
      nextCheckDate: nextCheckDate,
      message: `Reminder set successfully for ${daysToAdd} day${daysToAdd === 1 ? '' : 's'} from now`
    };
  } catch (error) {
    console.error("Error creating reminder action record:", error);
    return { 
      status: "error", 
      error: error.message || "Unknown error setting reminder" 
    };
  }
}
