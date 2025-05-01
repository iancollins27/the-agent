
/**
 * Implementation logic for the create_action_record tool
 */
import { validateCreateActionRecordParams } from './schema';
import { CreateActionRecordParams, CreateActionRecordResult } from './types';
import { handleMessageAction } from './handlers/messageActionHandler';
import { handleReminderAction } from './handlers/reminderActionHandler';
import { handleDataUpdateAction } from './handlers/dataUpdateActionHandler';
import { handleHumanReviewAction } from './handlers/humanReviewActionHandler';
import { createToolExecutionLogger } from '../utils/logging';

const executeWithLogging = createToolExecutionLogger();

export async function handleCreateActionRecord(
  supabase: any,
  params: CreateActionRecordParams,
  promptRunId: string,
  projectId: string
): Promise<CreateActionRecordResult> {
  return executeWithLogging('create_action_record', params, async () => {
    try {
      // Validate parameters
      const validation = validateCreateActionRecordParams(params);
      if (!validation.valid) {
        return {
          status: 'error',
          error: validation.errors.join(', ')
        };
      }

      // Route to the appropriate handler based on action type
      switch (params.action_type) {
        case 'message':
          return {
            status: 'success',
            ...(await handleMessageAction(supabase, promptRunId, projectId, params))
          };
          
        case 'set_future_reminder':
          return {
            status: 'success',
            ...(await handleReminderAction(supabase, promptRunId, projectId, params))
          };
          
        case 'data_update':
          return {
            status: 'success',
            ...(await handleDataUpdateAction(supabase, promptRunId, projectId, params))
          };
          
        case 'human_in_loop':
          return {
            status: 'success',
            ...(await handleHumanReviewAction(supabase, promptRunId, projectId, params))
          };
          
        default:
          return {
            status: 'error',
            error: `Unsupported action type: ${params.action_type}`
          };
      }
    } catch (error) {
      console.error('Error in handleCreateActionRecord:', error);
      return {
        status: 'error',
        error: error.message || 'Unknown error executing create_action_record'
      };
    }
  });
}
