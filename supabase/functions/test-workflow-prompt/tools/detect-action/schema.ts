
/**
 * Validation schema for detect_action tool
 */
import { validateRequiredParams } from '../utils/validation.ts';
import { DetectActionParams } from './types.ts';

/**
 * Validates parameters for the detect_action tool
 */
export function validateDetectActionParams(
  params: DetectActionParams
): { valid: boolean; errors: string[] } {
  return validateRequiredParams(
    params,
    ['decision', 'reason']
  );
}

// Export the schema for use in the tool definition
export const detectActionSchema = {
  name: 'detect_action',
  description: 'Analyzes project context and determines if action is needed',
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The content to analyze for action detection'
      },
      project_context: {
        type: 'string',
        description: 'Project context information for better decision making'
      },
      decision: {
        type: 'string',
        enum: [
          'ACTION_NEEDED', 
          'NO_ACTION', 
          'SET_FUTURE_REMINDER', 
          'REQUEST_HUMAN_REVIEW',
          'QUERY_KNOWLEDGE_BASE'
        ],
        description: 'The decision made by the AI about what action to take'
      },
      reason: {
        type: 'string',
        description: 'Reason for the decision'
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Priority level for the detected action'
      },
      days_until_check: {
        type: 'integer',
        description: 'For SET_FUTURE_REMINDER, specify how many days until the next check'
      },
      check_reason: {
        type: 'string',
        description: 'For SET_FUTURE_REMINDER, specify reason for the future check'
      }
    },
    required: ['decision', 'reason']
  }
};
