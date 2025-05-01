
/**
 * Implementation logic for the detect_action tool
 */
import { validateDetectActionParams } from './schema';
import { DetectActionParams, DetectActionResult } from './types';
import { createToolExecutionLogger } from '../utils/logging';

const executeWithLogging = createToolExecutionLogger();

export async function handleDetectAction(
  supabase: any,
  params: DetectActionParams,
  promptRunId: string,
  projectId: string
): Promise<DetectActionResult> {
  return executeWithLogging('detect_action', params, async () => {
    // Validate parameters
    const validation = validateDetectActionParams(params);
    if (!validation.valid) {
      return {
        status: 'error',
        error: validation.errors.join(', '),
        decision: params.decision,
        reason: params.reason || 'Invalid parameters',
        priority: params.priority || 'medium',
        reminderSet: false
      };
    }

    // Set defaults for missing fields
    const priority = params.priority || 'medium';

    // Map action decision to response
    const result: DetectActionResult = {
      decision: params.decision,
      reason: params.reason,
      priority,
      reminderSet: params.decision === 'SET_FUTURE_REMINDER',
      status: 'success'
    };

    // Add reminder days if applicable
    if (params.decision === 'SET_FUTURE_REMINDER' && params.days_until_check) {
      result.reminderDays = params.days_until_check;
    }

    return result;
  });
}
