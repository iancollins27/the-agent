
/**
 * Handler for message action type
 */
import { MessageActionParams } from '../types.ts';
import { validateRequiredParams } from '../../../utils/validation.ts';

export async function handleMessageAction(
  supabase: any,
  promptRunId: string,
  projectId: string,
  actionData: MessageActionParams
): Promise<{ action_record_id?: string, error?: string }> {
  try {
    // Validate required parameters
    const validation = validateRequiredParams(actionData, ['message_content']);
    if (!validation.valid) {
      return { error: validation.errors.join(', ') };
    }
    
    // Create the message action
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'message',
        action_payload: {
          message: actionData.message_content,
          recipient: actionData.recipient || null,
          send_method: actionData.send_method || 'sms',
          description: actionData.description || `Send ${actionData.send_method || 'sms'} to ${actionData.recipient || 'user'}`
        },
        requires_approval: true,
        status: 'pending',
        message: actionData.message_content
      })
      .select()
      .single();
      
    if (error) {
      console.error("Error creating message action:", error);
      throw new Error(`Failed to create message action: ${error.message}`);
    }
    
    return { action_record_id: data.id };
  } catch (error) {
    console.error("Error in handleMessageAction:", error);
    return { error: error.message || "Unknown error creating message action" };
  }
}
