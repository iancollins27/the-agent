import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Handle escalation action type
 */
export async function handleEscalation(
  supabase: SupabaseClient,
  promptRunId: string,
  projectId: string,
  actionData: any
) {
  try {
    console.log("Processing escalation action for project:", projectId);
    console.log("Escalation action data:", actionData);

    // Get project details for context
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        project_name,
        summary,
        next_step,
        Address,
        companies(name, id)
      `)
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project data:", projectError);
      return {
        status: "error",
        error: "Failed to fetch project data for escalation"
      };
    }

    // Get escalation recipients for the company
    const { data: escalationRecipients, error: recipientsError } = await supabase
      .from('escalation_config')
      .select('*')
      .eq('company_id', projectData.companies.id)
      .eq('is_active', true)
      .contains('notification_types', ['escalation']);

    if (recipientsError) {
      console.error("Error fetching escalation recipients:", recipientsError);
      return {
        status: "error",
        error: "Failed to fetch escalation recipients"
      };
    }

    if (!escalationRecipients || escalationRecipients.length === 0) {
      console.warn("No escalation recipients configured for company:", projectData.companies.id);
      return {
        status: "error",
        error: "No escalation recipients configured for this company"
      };
    }

    // Create the escalation action record
    const { data: actionRecord, error: actionError } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'escalation',
        action_payload: {
          reason: actionData.reason || 'Project requires escalation',
          description: actionData.description || 'Project has been escalated for manager review',
          escalation_details: actionData.escalation_details || 'No specific details provided',
          project_details: {
            name: projectData.project_name,
            address: projectData.Address,
            summary: projectData.summary,
            next_step: projectData.next_step
          },
          recipients_count: escalationRecipients.length
        },
        requires_approval: false, // Escalations are executed immediately
        status: 'pending' // Will be updated to 'executed' after notifications are sent
      })
      .select()
      .single();

    if (actionError) {
      console.error("Error creating escalation action record:", actionError);
      return {
        status: "error",
        error: "Failed to create escalation action record"
      };
    }

    // Send notifications to each escalation recipient
    const notificationResults = [];
    for (const recipient of escalationRecipients) {
      try {
        // Prepare escalation message
        const escalationMessage = formatEscalationMessage(
          projectData,
          actionData,
          recipient.recipient_name
        );

        // Call the send-communication function for SMS
        const { data: commResult, error: commError } = await supabase.functions.invoke('send-communication', {
          body: {
            channel: 'sms',
            messageContent: escalationMessage,
            recipient: {
              name: recipient.recipient_name,
              phone: recipient.recipient_phone
            },
            projectId: projectId,
            companyId: projectData.companies.id,
            isTest: false
          }
        });

        if (commError) {
          console.error(`Error sending escalation SMS to ${recipient.recipient_name}:`, commError);
          notificationResults.push({
            recipient: recipient.recipient_name,
            success: false,
            error: commError.message
          });
        } else {
          console.log(`Escalation SMS sent successfully to ${recipient.recipient_name}`);
          notificationResults.push({
            recipient: recipient.recipient_name,
            success: true,
            communication_id: commResult?.communication_id
          });
        }
      } catch (error) {
        console.error(`Error processing escalation for ${recipient.recipient_name}:`, error);
        notificationResults.push({
          recipient: recipient.recipient_name,
          success: false,
          error: error.message
        });
      }
    }

    // Update the action record with results
    const successCount = notificationResults.filter(r => r.success).length;
    const failureCount = notificationResults.filter(r => !r.success).length;

    await supabase
      .from('action_records')
      .update({
        status: successCount > 0 ? 'executed' : 'failed',
        executed_at: new Date().toISOString(),
        execution_result: {
          notifications_sent: successCount,
          notifications_failed: failureCount,
          results: notificationResults
        }
      })
      .eq('id', actionRecord.id);

    console.log(`Escalation processed: ${successCount} successful, ${failureCount} failed notifications`);

    return {
      status: "success",
      action_record_id: actionRecord.id,
      notifications_sent: successCount,
      notifications_failed: failureCount,
      results: notificationResults,
      message: `Escalation processed successfully. ${successCount} notification(s) sent.`
    };

  } catch (error) {
    console.error("Error in escalation handler:", error);
    return {
      status: "error",
      error: error.message || "Unknown error processing escalation"
    };
  }
}

/**
 * Format the escalation message for SMS
 */
function formatEscalationMessage(
  projectData: any,
  actionData: any,
  recipientName: string
): string {
  const projectName = projectData.project_name || 'Unnamed Project';
  const address = projectData.Address || 'No address specified';
  const reason = actionData.reason || 'Project requires escalation';
  const details = actionData.escalation_details || '';

  let message = `🚨 PROJECT ESCALATION\n\n`;
  message += `Hi ${recipientName},\n\n`;
  message += `Project: ${projectName}\n`;
  message += `Address: ${address}\n\n`;
  message += `Reason: ${reason}\n`;
  
  if (details) {
    message += `Details: ${details}\n`;
  }
  
  if (projectData.next_step) {
    message += `Next Step: ${projectData.next_step}\n`;
  }

  message += `\nPlease review this project immediately.`;

  // Keep message under SMS limits (160 chars for single SMS)
  if (message.length > 300) {
    message = `🚨 ESCALATION: ${projectName} at ${address}. ${reason}. Please review immediately.`;
  }

  return message;
}
