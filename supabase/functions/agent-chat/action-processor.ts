
/**
 * Action Processor
 * Extracts and processes action requests from AI responses
 */

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
    }
  } catch (parseError) {
    console.error('Error parsing action data:', parseError);
  }
  
  return { finalAnswer, actionRecordId };
}
