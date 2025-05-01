
/**
 * Handler for reminder action type
 */
import { ReminderActionParams } from '../types.ts';
import { validateRequiredParams } from '../../../utils/validation.ts';

export async function handleReminderAction(
  supabase: any,
  promptRunId: string,
  projectId: string,
  actionData: ReminderActionParams
): Promise<{ 
  action_record_id?: string;
  reminderSet?: boolean;
  reminderDays?: number;
  nextCheckDate?: string;
  error?: string;
}> {
  try {
    // Validate required parameters
    const validation = validateRequiredParams(actionData, ['check_reason']);
    if (!validation.valid) {
      return { error: validation.errors.join(', ') };
    }
    
    // Calculate the next check date
    const daysUntilCheck = actionData.days_until_check || 7;
    const nextCheckDate = new Date();
    nextCheckDate.setDate(nextCheckDate.getDate() + daysUntilCheck);
    
    console.log(`Setting next check date for project ${projectId} to ${nextCheckDate.toISOString()} (${daysUntilCheck} days from now)`);
    
    // Update the project's next_check_date
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        next_check_date: nextCheckDate.toISOString()
      })
      .eq('id', projectId);
    
    if (updateError) {
      console.error("Error updating project next_check_date:", updateError);
    }
    
    // Format the description
    const description = actionData.description || 
      `Set reminder to check in ${daysUntilCheck} days: ${actionData.check_reason}`;
    
    // Create an action payload with the reminder details
    const actionPayload = {
      description,
      check_reason: actionData.check_reason,
      days_until_check: daysUntilCheck
    };
    
    console.log("Creating action record with data:", actionData);
    
    // Create the reminder action record
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'set_future_reminder',
        action_payload: actionPayload,
        requires_approval: false,
        status: 'executed',
        executed_at: new Date().toISOString()
      })
      .select();
    
    if (error) {
      console.error("Error creating reminder action:", error);
      throw new Error(`Failed to create reminder action: ${error.message}`);
    }
    
    console.log("Reminder action record created successfully:", data[0]);
    
    return {
      action_record_id: data[0].id,
      reminderSet: true,
      reminderDays: daysUntilCheck,
      nextCheckDate: nextCheckDate.toISOString(),
      message: "Reminder set successfully"
    };
  } catch (error) {
    console.error("Error in handleReminderAction:", error);
    return { error: error.message || "Unknown error creating reminder" };
  }
}
