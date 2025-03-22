
/**
 * Configuration for the business logic functionality
 */

// Configuration for message batching
export const BATCH_CONFIG = {
  // Time window in minutes for batching messages in the same conversation
  TIME_WINDOW_MINUTES: 15,
  // Maximum number of messages to collect before processing a batch
  MAX_BATCH_SIZE: 5,
};

// CORS headers for edge function responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
