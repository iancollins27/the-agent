
/**
 * Schema definition and validation for create_action_record tool
 */
import { validateEnum, validateRequiredParams, combineValidationResults } from '../utils/validation';
import { CreateActionRecordParams } from './types';
import { ActionType, ActionDecision } from '../types';
import { VALID_DECISIONS } from '../detect-action/schema';

const VALID_ACTION_TYPES: ActionType[] = [
  'message',
  'data_update',
  'set_future_reminder',
  'human_in_loop',
  'knowledge_query'
];

export const createActionRecordSchema = {
  name: 'create_action_record',
  description: 'Creates a specific action record based on the detection results. This should be called as a separate tool call after detect_action returns ACTION_NEEDED.',
  parameters: {
    type: 'object',
    properties: {
      action_type: {
        type: 'string',
        enum: VALID_ACTION_TYPES,
        description: 'The type of action to create'
      },
      decision: {
        type: 'string',
        enum: VALID_DECISIONS,
        description: 'The decision that led to this action, should match detect_action result'
      },
      // Message action parameters
      recipient: {
        type: 'string',
        description: 'For message actions, who should receive the message'
      },
      sender: {
        type: 'string',
        description: 'For message actions, who is sending the message (defaults to "BidList Project Manager")'
      },
      message_text: {
        type: 'string',
        description: 'For message actions, the content of the message'
      },
      // Data update action parameters
      field: {
        type: 'string',
        description: 'For data_update actions, the field to update'
      },
      value: {
        description: 'For data_update actions, the new value for the field'
      },
      // Reminder action parameters
      days_until_check: {
        type: 'number',
        description: 'For set_future_reminder actions, how many days until the check should be made'
      },
      check_reason: {
        type: 'string',
        description: 'For set_future_reminder actions, the reason why a future check is needed'
      },
      // Human review action parameters
      review_reason: {
        type: 'string',
        description: 'For human_in_loop actions, the reason why human review is needed'
      }
    },
    required: ['action_type', 'decision']
  }
};

export function validateCreateActionRecordParams(
  params: CreateActionRecordParams
): { valid: boolean; errors: string[] } {
  // Basic validation for all action types
  const baseValidation = validateRequiredParams(params, ['action_type', 'decision']);
  
  const validations = [baseValidation];
  
  // Add specific validation for action_type and decision
  if (params.action_type) {
    validations.push(validateEnum(
      params.action_type,
      VALID_ACTION_TYPES,
      'action_type'
    ));
  }
  
  if (params.decision) {
    validations.push(validateEnum(
      params.decision, 
      VALID_DECISIONS, 
      'decision'
    ));
  }
  
  // Action type specific validations
  switch (params.action_type) {
    case 'message':
      const messageContent = params.message_text || params.message || (params as any).message_content;
      if (!messageContent) {
        validations.push({
          valid: false,
          errors: ['Message content is required for message actions']
        });
      }
      if (!params.recipient) {
        validations.push({
          valid: false,
          errors: ['Recipient is required for message actions']
        });
      }
      break;
      
    case 'data_update':
      validations.push(validateRequiredParams(params as any, ['field', 'value']));
      break;
      
    case 'set_future_reminder':
      validations.push(validateRequiredParams(params as any, ['days_until_check', 'check_reason']));
      break;
      
    case 'human_in_loop':
      validations.push(validateRequiredParams(params as any, ['review_reason']));
      break;
  }
  
  return combineValidationResults(...validations);
}
