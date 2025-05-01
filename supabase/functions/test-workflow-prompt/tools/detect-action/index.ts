
/**
 * Main export for the detect_action tool
 */
import { detectActionSchema, validateDetectActionParams } from './schema.ts';
import { handleDetectAction } from './handler.ts';
import { Tool } from '../types.ts';
import { DetectActionParams, DetectActionResult } from './types.ts';

export const detectActionTool: Tool<DetectActionParams, DetectActionResult> = {
  definition: detectActionSchema,
  handler: {
    execute: handleDetectAction,
    validate: validateDetectActionParams
  }
};

export { DetectActionParams, DetectActionResult } from './types.ts';
