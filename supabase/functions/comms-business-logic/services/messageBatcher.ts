import { BATCH_CONFIG } from "../utils/config.ts";

/**
 * Determines if an SMS message should be batched based on recent activity
 * @param supabase Supabase client
 * @param communication Communication object
 * @param projectId Project ID
 * @returns Boolean indicating if the message should be batched
 */
export async function shouldBatchMessage(supabase: any, communication: any, projectId: string): Promise<boolean> {
  // Get the timestamp for the cutoff window
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - BATCH_CONFIG.TIME_WINDOW_MINUTES);
  
  // See if there's a batch in progress for this project and conversation
  const { data: batchStatus, error: batchStatusError } = await supabase
    .from('comms_batch_status')
    .select('*')
    .eq('project_id', projectId)
    .eq('batch_status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (batchStatusError && batchStatusError.code !== 'PGRST116') {
    console.error('Error checking batch status:', batchStatusError);
  }
  
  if (batchStatus) {
    // There's already a batch in progress
    console.log('Found existing batch in progress:', batchStatus.id);
    
    // Check if we've reached the maximum batch size
    const { count, error: countError } = await supabase
      .from('communications')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('batch_id', batchStatus.id);
      
    if (countError) {
      console.error('Error counting messages in batch:', countError);
      return true; // Default to batching if there's an error
    }
    
    if (count >= BATCH_CONFIG.MAX_BATCH_SIZE) {
      // We've reached the max batch size, so we should process now
      console.log(`Batch size limit reached (${count} messages). Processing now.`);
      return false;
    }
    
    // Otherwise, continue batching
    return true;
  }
  
  // If there's no existing batch, check if this is the first message in a new conversation
  // or if it's continuing an existing conversation that should start a new batch
  const { data: recentMessages, error: recentError } = await supabase
    .from('communications')
    .select('id, timestamp')
    .eq('project_id', projectId)
    .eq('type', 'SMS')
    .gt('timestamp', cutoffTime.toISOString())
    .order('timestamp', { ascending: false });
    
  if (recentError) {
    console.error('Error checking recent messages:', recentError);
    return false; // Process immediately if there's an error
  }
  
  // If there are no recent messages, this is the first message - process immediately
  if (!recentMessages || recentMessages.length === 0) {
    console.log('This appears to be the first message in a conversation. Processing immediately.');
    return false;
  }
  
  // Otherwise, start a new batch
  console.log(`Found ${recentMessages.length} recent messages. Starting a new batch.`);
  return true;
}

/**
 * Marks a message as part of a batch
 * @param supabase Supabase client
 * @param communicationId Communication ID
 * @param projectId Project ID
 */
export async function markMessageForBatch(supabase: any, communicationId: string, projectId: string): Promise<void> {
  // Get or create a batch for this project
  let batchId: string;
  
  const { data: existingBatch, error: batchError } = await supabase
    .from('comms_batch_status')
    .select('id')
    .eq('project_id', projectId)
    .eq('batch_status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  if (batchError && batchError.code !== 'PGRST116') {
    console.error('Error getting existing batch:', batchError);
  }
  
  if (existingBatch) {
    batchId = existingBatch.id;
  } else {
    // Create a new batch
    const { data: newBatch, error: createError } = await supabase
      .from('comms_batch_status')
      .insert({
        project_id: projectId,
        batch_status: 'in_progress',
        scheduled_processing_time: new Date(Date.now() + BATCH_CONFIG.TIME_WINDOW_MINUTES * 60 * 1000).toISOString()
      })
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating batch:', createError);
      return;
    }
    
    batchId = newBatch.id;
  }
  
  // Update the communication to mark it as part of the batch
  const { error: updateError } = await supabase
    .from('communications')
    .update({ batch_id: batchId })
    .eq('id', communicationId);
    
  if (updateError) {
    console.error('Error marking message for batch:', updateError);
  }
}
