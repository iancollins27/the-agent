
/**
 * Create action record tool implementation
 * Shared between agent-chat and test-workflow-prompt
 */
import { Tool } from '../types.ts';
import { createActionRecordSchema } from './schema.ts';
import { handleCreateActionRecord } from './handler.ts';

export const createActionRecordTool: Tool = {
  name: "create_action_record",
  description: "Creates an action record based on your analysis. Use this when you determine an action is needed (message, data update, or set a reminder).",
  schema: createActionRecordSchema,
  execute: handleCreateActionRecord
};
