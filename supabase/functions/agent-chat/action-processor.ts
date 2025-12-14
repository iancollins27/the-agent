
/**
 * Action Processor
 * Extracts and processes action requests from AI responses
 */

/**
 * Checks if a project meets the activation criteria for reminder actions
 * @param recordRec The project record from CRM
 * @returns Boolean indicating if the project meets activation criteria
 */
function checkActivationCriteria(recordRec: any): boolean {
  if (!recordRec) {
    return false;
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
  return entryCheck && statusCheck;
}

export async function processActionRequest(
  supabase: any,
  finalAnswer: string,
  projectData: any
): Promise<{ finalAnswer: string; actionRecordId: string | null }> {
  let actionRecordId: string | null = null;
  
  if (!finalAnswer || !projectData?.id) {
    return { finalAnswer, actionRecordId };
  }
  
  try {
    const jsonMatch = finalAnswer.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch || !jsonMatch[1]) {
      return { finalAnswer, actionRecordId };
    }
    
    const actionData = JSON.parse(jsonMatch[1].trim());
    console.log('Extracted action data:', actionData);
    
    if (actionData.action_type === "data_update" && actionData.field_to_update && actionData.new_value) {
      const { data: actionRecord, error: actionError } = await supabase
        .from('action_records')
        .insert({
          project_id: projectData.id,
          action_type: 'data_update',
          action_payload: {
            field: actionData.field_to_update,
            value: actionData.new_value,
            description: actionData.description || `Update ${actionData.field_to_update} to ${actionData.new_value}`
          },
          requires_approval: true,
          status: 'pending'
        })
        .select()
        .single();
      
      if (actionError) {
        console.error('Error creating action record:', actionError);
      } else {
        actionRecordId = actionRecord.id;
        console.log('Created data update action record:', actionRecord);
        
        // Remove the JSON block from the response
        finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
      }
    } 
    else if (actionData.action_type === "message" && actionData.recipient && actionData.message_content) {
      let recipientId = null;
      let senderId = null;
      
      // Find recipient contact
      if (actionData.recipient && actionData.recipient.length > 3 && 
          !["team", "customer", "client", "user"].includes(actionData.recipient.toLowerCase())) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, full_name')
          .ilike('full_name', `%${actionData.recipient}%`);
          
        if (contacts && contacts.length > 0) {
          recipientId = contacts[0].id;
          console.log(`Found contact match for "${actionData.recipient}": ${contacts[0].full_name} (${recipientId})`);
        }
      }
      
      // Find sender contact
      const senderName = actionData.sender || "System";
      if (senderName && senderName.length > 3 && senderName !== "System") {
        const { data: senders } = await supabase
          .from('contacts')
          .select('id, full_name')
          .ilike('full_name', `%${senderName}%`);
          
        if (senders && senders.length > 0) {
          senderId = senders[0].id;
          console.log(`Found sender match for "${senderName}": ${senders[0].full_name} (${senderId})`);
        }
      }
      
      const { data: actionRecord, error: actionError } = await supabase
        .from('action_records')
        .insert({
          project_id: projectData.id,
          action_type: 'message',
          action_payload: {
            recipient: actionData.recipient,
            sender: senderName,
            message_content: actionData.message_content,
            description: actionData.description || `Send message to ${actionData.recipient}`
          },
          message: actionData.message_content,
          recipient_id: recipientId,
          sender_ID: senderId,
          requires_approval: true,
          status: 'pending'
        })
        .select()
        .single();
      
      if (actionError) {
        console.error('Error creating message action record:', actionError);
      } else {
        actionRecordId = actionRecord.id;
        console.log('Created message action record:', actionRecord);
        
        finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
      }
    } 
    else if (actionData.action_type === "set_future_reminder" && actionData.days_until_check) {
      // Check if we need to verify activation criteria
      let shouldCreateReminder = true;
      
      // If project data has CRM fields, check activation criteria
      if (projectData.crm_data) {
        shouldCreateReminder = checkActivationCriteria(projectData.crm_data);
        if (!shouldCreateReminder) {
          console.log(`Project ${projectData.id} does not meet activation criteria for reminder action.`);
        }
      } else {
        // Try to fetch CRM data to check activation criteria
        try {
          const { data: project } = await supabase
            .from('projects')
            .select('crm_id')
            .eq('id', projectData.id)
            .single();
            
          if (project?.crm_id) {
            // We have a CRM ID, let's try to get the data
            const { data: crmResponse } = await supabase.functions.invoke(
              'agent-chat',
              {
                body: {
                  tool: 'read_crm_data',
                  args: {
                    crm_id: project.crm_id,
                    entity_type: 'project'
                  },
                  context: {
                    project_id: projectData.id
                  }
                }
              }
            );
            
            if (crmResponse?.data) {
              shouldCreateReminder = checkActivationCriteria(crmResponse.data);
              if (!shouldCreateReminder) {
                console.log(`Project ${projectData.id} does not meet activation criteria based on CRM data.`);
              }
            }
          }
        } catch (error) {
          console.warn(`Could not check activation criteria for project ${projectData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue with reminder creation as a fallback
          shouldCreateReminder = true;
        }
      }
      
      // Only create the reminder if activation criteria are met
      if (shouldCreateReminder) {
        const { data: actionRecord, error: actionError } = await supabase
          .from('action_records')
          .insert({
            project_id: projectData.id,
            action_type: 'set_future_reminder',
            action_payload: {
              days_until_check: actionData.days_until_check,
              check_reason: actionData.check_reason || 'Follow-up check',
              description: actionData.description || `Check project in ${actionData.days_until_check} days`
            },
            requires_approval: true,
            status: 'pending'
          })
          .select()
          .single();
        
        if (actionError) {
          console.error('Error creating reminder action record:', actionError);
        } else {
          actionRecordId = actionRecord.id;
          console.log('Created reminder action record:', actionRecord);
          
          finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
        }
      } else {
        console.log('Skipping reminder action creation due to activation criteria not being met.');
        finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
        finalAnswer += '\n\n**Note:** The reminder action was not created because the project does not meet the activation criteria.';
      }
    }
  } catch (parseError) {
    console.error('Error parsing action data:', parseError);
  }
  
  return { finalAnswer, actionRecordId };
}
