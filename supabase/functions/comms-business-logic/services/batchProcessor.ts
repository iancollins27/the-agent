
import { 
  processMessagesForProject, 
  processMultiProjectMessages 
} from "./messageProcessor.ts";

/**
 * Find and process all batches that are due for processing
 * @param supabase Supabase client
 * @returns Number of processed batches
 */
export async function processDueBatches(supabase: any): Promise<number> {
  console.log('Checking for communication batches due for processing...');
  
  const now = new Date().toISOString();
  
  // Find all batches that are due for processing
  const { data: dueBatches, error: batchError } = await supabase
    .from('comms_batch_status')
    .select('id, project_id, scheduled_processing_time')
    .eq('batch_status', 'in_progress')
    .lte('scheduled_processing_time', now)
    .order('scheduled_processing_time', { ascending: true });
    
  if (batchError) {
    console.error('Error finding due batches:', batchError);
    return 0;
  }
  
  if (!dueBatches || dueBatches.length === 0) {
    console.log('No batches are due for processing');
    return 0;
  }
  
  console.log(`Found ${dueBatches.length} batches due for processing`);
  
  // Process each due batch
  let processedCount = 0;
  for (const batch of dueBatches) {
    try {
      console.log(`Processing batch ${batch.id} for project ${batch.project_id}`);
      
      // Update batch status to processing
      const { error: updateError } = await supabase
        .from('comms_batch_status')
        .update({ batch_status: 'processing' })
        .eq('id', batch.id);
        
      if (updateError) {
        console.error(`Error updating batch ${batch.id} status:`, updateError);
        continue;
      }
      
      // Check if this is a multi-project batch
      const { data: batchMessages, error: messagesError } = await supabase
        .from('communications')
        .select('*')
        .eq('batch_id', batch.id)
        .limit(1);
        
      if (messagesError) {
        console.error(`Error checking batch ${batch.id} messages:`, messagesError);
        continue;
      }
      
      const isMultiProject = 
        batchMessages && 
        batchMessages.length > 0 && 
        batchMessages[0].multi_project_potential === true;
      
      // Process the batch based on whether it's multi-project or not
      if (isMultiProject) {
        await processMultiProjectMessages(supabase, batch.project_id, batch.id);
      } else {
        await processMessagesForProject(supabase, batch.project_id);
      }
      
      processedCount++;
      
      // Update batch as completed
      const { error: completeError } = await supabase
        .from('comms_batch_status')
        .update({ 
          batch_status: 'completed',
          processed_at: new Date().toISOString()
        })
        .eq('id', batch.id);
        
      if (completeError) {
        console.error(`Error completing batch ${batch.id}:`, completeError);
      }
    } catch (error) {
      console.error(`Error processing batch ${batch.id}:`, error);
      
      // Mark batch as error
      await supabase
        .from('comms_batch_status')
        .update({ 
          batch_status: 'error',
          processed_at: new Date().toISOString()
        })
        .eq('id', batch.id);
    }
  }
  
  console.log(`Successfully processed ${processedCount} out of ${dueBatches.length} due batches`);
  return processedCount;
}
