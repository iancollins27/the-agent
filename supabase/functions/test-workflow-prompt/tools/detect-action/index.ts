
/**
 * Main export for the detect_action tool
 */
import { detectActionSchema, validateDetectActionParams } from './schema';
import { handleDetectAction } from './handler';
import { Tool } from '../types';
import { DetectActionParams, DetectActionResult } from './types';

export const detectActionTool: Tool<DetectActionParams, DetectActionResult> = {
  definition: detectActionSchema,
  handler: {
    execute: handleDetectAction,
    validate: validateDetectActionParams
  }
};

export { DetectActionParams, DetectActionResult } from './types';
