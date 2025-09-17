
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { setProjectNextCheckDate } from "../projects.ts";

/**
 * Checks if a project meets the activation criteria for reminder actions
 * @param recordRec The project record from CRM
 * @returns Object with result and reason
 */
export function checkActivationCriteria(recordRec: any): { 
  meetsActivationCriteria: boolean; 
  reason?: string 
} {
  if (!recordRec) {
    return { 
      meetsActivationCriteria: false, 
      reason: "No project data provided" 
    };
  }

  // Check entry criteria
  let entryCheck = false;
  if (
    recordRec.Contract_Signed != null && 
    recordRec.Roof_Install_Finalized == null && 
    recordRec.Test_Record === false
  ) {
    entryCheck = true;
  }

  // Check status criteria
  let statusCheck = false;
  if (
    recordRec.Status !== "Archived" && 
    recordRec.Status !== "VOID" && 
    recordRec.Status !== "Cancelled" && 
    recordRec.Status !== "Canceled"
  ) {
    statusCheck = true;
  }

  // Both criteria must be met
  const meetsActivationCriteria = entryCheck && statusCheck;

  // Return result with reason if criteria not met
  if (!meetsActivationCriteria) {
    let reason = "";
    if (!entryCheck) {
      reason = "Project does not meet entry criteria: Contract signed, roof install not finalized, and not a test record";
    } else if (!statusCheck) {
      reason = `Project status '${recordRec.Status}' is not eligible for reminders`;
    }
    
    return { meetsActivationCriteria, reason };
  }

  return { meetsActivationCriteria: true };
}

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
    // If project data is provided, check activation criteria
    if (actionData.project_data) {
      const { meetsActivationCriteria, reason } = checkActivationCriteria(actionData.project_data);
      if (!meetsActivationCriteria) {
        console.log(`Project ${projectId} does not meet activation criteria: ${reason}`);
        return { 
          status: "skipped", 
          reason: reason || "Does not meet activation criteria",
          message: `Reminder not set: ${reason}`
        };
      }
    } else {
      // If no project data provided, fetch from CRM
      try {
        // Get CRM ID for this project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('crm_id')
          .eq('id', projectId)
          .single();
          
        if (!projectError && projectData?.crm_id) {
          // Call the CRM to get project details
          const { data: crmResponse } = await supabase.functions.invoke(
            'agent-chat',
            {
              body: {
                tool: 'read_crm_data',
                args: {
                  crm_id: projectData.crm_id,
                  entity_type: 'project'
                },
                context: {
                  project_id: projectId
                }
              }
            }
          );
          
          if (crmResponse?.data) {
            const { meetsActivationCriteria, reason } = checkActivationCriteria(crmResponse.data);
            if (!meetsActivationCriteria) {
              console.log(`Project ${projectId} does not meet activation criteria: ${reason}`);
              return { 
                status: "skipped", 
                reason: reason || "Does not meet activation criteria",
                message: `Reminder not set: ${reason}`
              };
            }
          }
        }
      } catch (error) {
        console.warn(`Could not check activation criteria for project ${projectId}: ${error.message}`);
        // Continue with reminder creation even if we can't check criteria
        // This is a fallback to ensure reminders aren't lost due to API issues
      }
    }
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
