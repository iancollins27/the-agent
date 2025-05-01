
/**
 * Validation schema for create_action_record tool
 */
import { validateRequiredParams } from '../utils/validation.ts';
import { CreateActionRecordParams } from './types.ts';

/**
 * Validates parameters for the create_action_record tool
 * Handles different validation for different action types
 */
export function validateCreateActionRecordParams(
  params: CreateActionRecordParams
): { valid: boolean; errors: string[] } {
  // First validate common required fields
  const baseValidation = validateRequiredParams(
    params, 
    ['action_type', 'decision']
  );
  
  if (!baseValidation.valid) {
    return baseValidation;
  }
  
  // Then validate based on action type
  switch (params.action_type) {
    case 'message':
      return validateRequiredParams(params, ['message_content', 'recipient']);
      
    case 'data_update':
      return validateRequiredParams(params, ['field', 'value']);
      
    case 'set_future_reminder':
      return validateRequiredParams(params, ['days_until_check', 'check_reason']);
      
    case 'human_in_loop':
      return validateRequiredParams(params, ['review_reason']);
      
    default:
      return { 
        valid: false, 
        errors: [`Unsupported action type: ${params.action_type}`] 
      };
  }
}

// Export the schema for use in the tool definition
export const createActionRecordSchema = {
  name: 'create_action_record',
  description: 'Creates an action record based on an AI decision',
  parameters: {
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        enum: ['ACTION_NEEDED', 'NO_ACTION', 'SET_FUTURE_REMINDER', 'REQUEST_HUMAN_REVIEW'],
        description: 'The decision made by the AI about what action to take'
      },
      action_type: {
        type: 'string',
        enum: ['message', 'data_update', 'set_future_reminder', 'human_in_loop'],
        description: 'The type of action to create'
      },
      priority: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'The priority level of the action'
      },
      // Message action fields
      recipient: {
        type: 'string',
        description: 'The recipient of the message (for message actions)'
      },
      message_content: {
        type: 'string',
        description: 'The content of the message to send (for message actions)'
      },
      // Data update fields
      field: {
        type: 'string',
        description: 'The field to update (for data_update actions)'
      },
      value: {
        type: 'string',
        description: 'The new value for the field (for data_update actions)'
      },
      // Reminder fields
      days_until_check: {
        type: 'number',
        description: 'Number of days until the next check (for set_future_reminder actions)'
      },
      check_reason: {
        type: 'string',
        description: 'Reason for the future check (for set_future_reminder actions)'
      },
      // Human review fields
      review_reason: {
        type: 'string',
        description: 'Reason for requesting human review (for human_in_loop actions)'
      },
      // Common optional fields
      description: {
        type: 'string',
        description: 'Optional description of the action'
      }
    },
    required: ['decision', 'action_type']
  }
};
