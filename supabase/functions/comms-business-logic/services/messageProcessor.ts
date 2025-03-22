
import { updateProjectWithAI } from "./projectUpdater.ts";

/**
 * Process all communications in a batch for a project
 * @param supabase Supabase client
 * @param projectId Project ID
 */
export async function processMessagesForProject(supabase: any, projectId: string): Promise<void> {
  console.log(`Processing all recent messages for project ${projectId}`);
  
  // Get all batched messages for this project
  const { data: batchedMessages, error: batchError } = await supabase
    .from('communications')
    .select('*')
    .eq('project_id', projectId)
    .not('batch_id', 'is', null)
    .order('timestamp', { ascending: true });
    
  if (batchError) {
    console.error('Error fetching batched messages:', batchError);
    return;
  }
  
  if (!batchedMessages || batchedMessages.length === 0) {
    console.log('No batched messages found to process');
    return;
  }
  
  console.log(`Found ${batchedMessages.length} batched messages to process`);
  
  // Mark batches as processing
  const batchIds = [...new Set(batchedMessages.map(msg => msg.batch_id))];
  for (const batchId of batchIds) {
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ batch_status: 'processing' })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
  }
  
  // Combine the messages into a unified context for the AI
  const combinedContext = {
    communication_type: 'SMS',
    communication_subtype: 'batch',
    communication_direction: 'mixed',
    communication_content: batchedMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.direction}: ${msg.content}`
    ).join('\n\n'),
    communication_participants: batchedMessages[0].participants, // Using the first message's participants
    communication_timestamp: new Date().toISOString(),
    batch_size: batchedMessages.length,
    batch_start: batchedMessages[0].timestamp,
    batch_end: batchedMessages[batchedMessages.length - 1].timestamp
  };
  
  // Process the combined batch with the AI
  await updateProjectWithAI(supabase, projectId, combinedContext);
  
  // Mark batches as completed
  for (const batchId of batchIds) {
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ 
        batch_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
  }
  
  console.log(`Successfully processed ${batchedMessages.length} messages in ${batchIds.length} batches`);
}

/**
 * Process a single communication for a project
 * @param supabase Supabase client
 * @param communication Communication object
 * @param projectId Project ID
 */
export async function processCommunicationForProject(supabase: any, communication: any, projectId: string): Promise<void> {
  console.log(`Processing individual communication ${communication.id} for project ${projectId}`);
  
  const contextData = {
    communication_type: communication.type,
    communication_subtype: communication.subtype,
    communication_direction: communication.direction,
    communication_content: communication.content || '',
    communication_participants: communication.participants,
    communication_timestamp: communication.timestamp
  };
  
  await updateProjectWithAI(supabase, projectId, contextData);
}
