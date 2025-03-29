
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { CommunicationRecordParams } from "../types.ts";

export async function createCommunicationRecord(
  supabase: SupabaseClient,
  params: CommunicationRecordParams
): Promise<{ id: string }> {
  const { projectId, channel, messageContent, recipient, providerInfo } = params;

  // Determine the appropriate subtype based on the channel
  let subtype = '';
  switch (channel.toUpperCase()) {
    case 'SMS':
      subtype = 'SMS_MESSAGE';
      break;
    case 'EMAIL':
      subtype = 'EMAIL_MESSAGE';
      break;
    case 'CALL':
      subtype = 'CALL_INITIATED';
      break;
    default:
      subtype = `${channel.toUpperCase()}_MESSAGE`;
  }

  // Check if the communications table has a check constraint on the direction column
  // and ensure we're using one of the allowed values (e.g., 'OUTBOUND', 'INBOUND')
  const { data: commRecord, error: commError } = await supabase
    .from('communications')
    .insert({
      project_id: projectId,
      type: channel.toUpperCase(),
      subtype: subtype,
      direction: 'OUTBOUND', // Make sure this matches one of the allowed values in the check constraint
      content: messageContent,
      timestamp: new Date().toISOString(),
      participants: [
        {
          type: 'recipient',
          contact_id: recipient.id,
          name: recipient.name,
          phone: recipient.phone,
          email: recipient.email
        }
      ],
      provider: providerInfo.provider_name,
      status: 'PENDING'
    })
    .select()
    .single();

  if (commError) {
    console.error(`Error creating communication record: ${commError.message}`);
    throw new Error(`Failed to create communication record: ${commError.message}`);
  }
  
  return commRecord;
}

export async function updateActionRecord(
  supabase: SupabaseClient,
  actionId: string,
  communicationId: string,
  providerName: string
): Promise<void> {
  const { error: actionUpdateError } = await supabase
    .from('action_records')
    .update({
      execution_result: {
        status: 'comm_initiated',
        timestamp: new Date().toISOString(),
        communication_id: communicationId,
        provider: providerName,
        details: `Communication initiated via ${providerName}`
      }
    })
    .eq('id', actionId);

  if (actionUpdateError) {
    console.error(`Error updating action record: ${actionUpdateError.message}`);
  }
}
