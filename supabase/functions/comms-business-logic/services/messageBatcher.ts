import { BATCH_CONFIG } from "../utils/config.ts";

/**
 * Determines if an SMS message should be batched based on recent activity
 * @param supabase Supabase client
 * @param communication Communication object
 * @param projectId Project ID
 * @returns Boolean indicating if the message should be batched
 */
export async function shouldBatchMessage(supabase: any, communication: any, projectId: string): Promise<boolean> {
  console.log(`Message batching disabled as requested. Processing message immediately for project ${projectId}`);
  // Always return false to disable batching and process messages immediately
  return false;
}

/**
 * Marks a message as part of a batch
 * @param supabase Supabase client
 * @param communicationId Communication ID
 * @param projectId Project ID
 */
export async function markMessageForBatch(supabase: any, communicationId: string, projectId: string): Promise<void> {
  console.log(`Batching disabled. Not marking message ${communicationId} for batch in project ${projectId}`);
  // This function is essentially a no-op now since batching is disabled
  // but we keep it to maintain the API
  console.log(`No action taken - batching is disabled`);
}
