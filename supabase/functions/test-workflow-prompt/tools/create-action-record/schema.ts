
/**
 * Validation schema for create_action_record tool
 */
import { 
  validateRequiredParams,
  validateEnum,
  combineValidationResults
} from '../utils/validation.ts';

import {
  CreateActionRecordParams,
  MessageActionParams,
  ReminderActionParams,
  DataUpdateActionParams,
  HumanReviewActionParams
} from './types.ts';

/**
 * Validates parameters for the create_action_record tool
 */
export function validateCreateActionRecordParams(
  params: CreateActionRecordParams
): { valid: boolean; errors: string[] } {
  // First validate the common required parameters
  const baseValidation = validateRequiredParams(
    params,
    ['action_type']
  );
  
  // Validate that action_type is one of the allowed values
  const actionTypeValidation = validateEnum(
    params.action_type,
    ['message', 'set_future_reminder', 'data_update', 'human_in_loop'],
    'action_type'
  );
  
  // Validate specific parameters based on action_type
  let specificValidation = { valid: true, errors: [] };
  
  switch (params.action_type) {
    case 'message':
      specificValidation = validateMessageActionParams(params as MessageActionParams);
      break;
    case 'set_future_reminder':
      specificValidation = validateReminderActionParams(params as ReminderActionParams);
      break;
    case 'data_update':
      specificValidation = validateDataUpdateActionParams(params as DataUpdateActionParams);
      break;
    case 'human_in_loop':
      specificValidation = validateHumanReviewActionParams(params as HumanReviewActionParams);
      break;
  }
  
  // Combine all validation results
  return combineValidationResults(
    baseValidation,
    actionTypeValidation,
    specificValidation
  );
}

/**
 * Validates parameters specific to message actions
 */
function validateMessageActionParams(params: MessageActionParams): { valid: boolean; errors: string[] } {
  return validateRequiredParams(params, ['message_content']);
}

/**
 * Validates parameters specific to reminder actions
 */
function validateReminderActionParams(params: ReminderActionParams): { valid: boolean; errors: string[] } {
  return validateRequiredParams(params, ['check_reason']);
}

/**
 * Validates parameters specific to data update actions
 */
function validateDataUpdateActionParams(params: DataUpdateActionParams): { valid: boolean; errors: string[] } {
  return validateRequiredParams(params, ['field', 'value']);
}

/**
 * Validates parameters specific to human review actions
 */
function validateHumanReviewActionParams(params: HumanReviewActionParams): { valid: boolean; errors: string[] } {
  return validateRequiredParams(params, ['review_reason']);
}
