
/**
 * Detect action tool implementation
 */
import { Tool } from '../types.ts';
import { detectActionSchema } from './schema.ts';
import { handleDetectAction } from './handler.ts';

export const detectAction: Tool = {
  name: "detect_action",
  description: "Detects if any action is needed based on the project state. Always call this tool first to determine the course of action.",
  schema: detectActionSchema,
  execute: handleDetectAction
};
