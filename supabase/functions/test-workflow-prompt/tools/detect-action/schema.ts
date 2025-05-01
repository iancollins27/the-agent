
/**
 * Schema definition and validation for detect_action tool
 */
import { validateEnum, validateRequiredParams, combineValidationResults } from '../utils/validation';
import { DetectActionParams } from './types';
import { ActionDecision, ActionPriority } from '../types';

export const VALID_DECISIONS: ActionDecision[] = [
  'ACTION_NEEDED',
  'NO_ACTION',
  'SET_FUTURE_REMINDER',
  'REQUEST_HUMAN_REVIEW',
  'QUERY_KNOWLEDGE_BASE'
];

export const VALID_PRIORITIES: ActionPriority[] = ['high', 'medium', 'low'];

export const detectActionSchema = {
  name: 'detect_action',
  description: 'Analyzes project context and determines if any action is needed, postponed, or unnecessary. This should always be your first tool.',
  parameters: {
    type: 'object',
    properties: {
      decision: {
        type: 'string',
        enum: VALID_DECISIONS,
        description: 'The decision about what course of action to take'
      },
      reason: {
        type: 'string',
        description: 'Detailed explanation of your decision-making process and reasoning'
      },
      priority: {
        type: 'string',
        enum: VALID_PRIORITIES,
        description: 'The priority level of the action or reminder'
      },
      days_until_check: {
        type: 'number',
        description: 'For SET_FUTURE_REMINDER decision, how many days until the check should be made'
      },
      check_reason: {
        type: 'string',
        description: 'For SET_FUTURE_REMINDER decision, the reason why a future check is needed'
      }
    },
    required: ['decision', 'reason']
  }
};

export function validateDetectActionParams(
  params: DetectActionParams
): { valid: boolean; errors: string[] } {
  const requiredValidation = validateRequiredParams(params, ['decision', 'reason']);
  
  const validations = [requiredValidation];
  
  // Add specific validation for decision
  if (params.decision) {
    validations.push(validateEnum(
      params.decision, 
      VALID_DECISIONS, 
      'decision'
    ));
  }
  
  // Add specific validation for priority if present
  if (params.priority) {
    validations.push(validateEnum(
      params.priority, 
      VALID_PRIORITIES, 
      'priority'
    ));
  }
  
  // Add validation for reminder fields if decision is SET_FUTURE_REMINDER
  if (params.decision === 'SET_FUTURE_REMINDER') {
    if (!params.days_until_check) {
      validations.push({
        valid: false,
        errors: ['days_until_check is required for SET_FUTURE_REMINDER decision']
      });
    }
    if (!params.check_reason) {
      validations.push({
        valid: false,
        errors: ['check_reason is required for SET_FUTURE_REMINDER decision']
      });
    }
  }
  
  return combineValidationResults(...validations);
}
