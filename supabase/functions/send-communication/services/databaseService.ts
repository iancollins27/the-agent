
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { CommunicationRecordParams, CommDirection } from "../types.ts";

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

  // Use the CommDirection type explicitly and ensure it exactly matches the database constraint
  // The database constraint requires 'INBOUND' or 'OUTBOUND' (uppercase)
  const direction: CommDirection = 'OUTBOUND';
  
  console.log(`Creating communication record with direction: ${direction}`);
  console.log(`Values being used - type: ${channel.toUpperCase()}, subtype: ${subtype}`);

  // First, check if we can query the communications table schema
  try {
    const { data: tableInfo, error: tableError } = await supabase
      .from('communications')
      .select('direction')
      .limit(1);
      
    if (tableError) {
      console.error(`Error querying communications table: ${tableError.message}`);
    } else {
      console.log('Successfully queried communications table');
    }
  } catch (e) {
    console.error(`Exception querying communications table: ${e.message}`);
  }

  // Now attempt to insert the record
  const { data: commRecord, error: commError } = await supabase
    .from('communications')
    .insert({
      project_id: projectId,
      type: channel.toUpperCase(),
      subtype: subtype,
      direction: direction,
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
    console.error(`Error details: ${JSON.stringify(commError)}`);
    throw new Error(`Failed to create communication record: ${commError.message}`);
  }
  
  console.log(`Successfully created communication record with ID: ${commRecord.id}`);
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
