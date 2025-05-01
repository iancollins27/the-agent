
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
    ['content', 'project_context']
  );
}
