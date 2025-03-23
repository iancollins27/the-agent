
import { processMultiProjectCommunication } from "../multiProjectProcessor.ts";

/**
 * Process all messages in a batch for multiple projects
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param batchId Batch ID
 */
export async function processMultiProjectMessages(supabase: any, projectId: string, batchId: string): Promise<void> {
  console.log(`Processing multi-project batch for batch ${batchId}`);
  
  try {
    // Get all messages in this batch
    const { data: batchMessages, error: batchError } = await supabase
      .from('communications')
      .select('*')
      .eq('batch_id', batchId)
      .order('timestamp', { ascending: true });
      
    if (batchError) {
      console.error('Error fetching batch messages:', batchError);
      return;
    }
    
    if (!batchMessages || batchMessages.length === 0) {
      console.log('No batched messages found to process');
      return;
    }
    
    // Mark batch as processing
    const { error: updateError } = await supabase
      .from('comms_batch_status')
      .update({ batch_status: 'processing' })
      .eq('id', batchId);
      
    if (updateError) {
      console.error(`Error updating batch ${batchId} status:`, updateError);
    }
    
    // Combine the messages
    const combinedContent = batchMessages.map(msg => 
      `[${new Date(msg.timestamp).toLocaleString()}] ${msg.direction}: ${msg.content}`
    ).join('\n\n');
    
    // Create a synthetic communication object to represent the batch
    const batchCommunication = {
      id: batchId,
      type: 'SMS',
      subtype: 'batch',
      direction: 'mixed',
      content: combinedContent,
      participants: batchMessages[0].participants,
      timestamp: new Date().toISOString(),
      duration: null,
      batch_id: batchId
    };
    
    // Use the multi-project processing function
    await processMultiProjectCommunication(supabase, batchCommunication);
    
    // Mark batch as completed
    const { error: completeError } = await supabase
      .from('comms_batch_status')
      .update({ 
        batch_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', batchId);
      
    if (completeError) {
      console.error(`Error marking batch ${batchId} as completed:`, completeError);
    }
    
    console.log(`Successfully processed multi-project batch ${batchId}`);
  } catch (error) {
    console.error('Error in processMultiProjectMessages:', error);
  }
}
