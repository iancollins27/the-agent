
/**
 * Create action record tool implementation
 */
import { Tool } from '../types.ts';
import { createActionRecordSchema } from './schema.ts';
import { handleCreateActionRecord } from './handler.ts';

export const createActionRecord: Tool = {
  name: "create_action_record",
  description: "Creates an action record based on the detect_action result. Use when decision is ACTION_NEEDED.",
  schema: createActionRecordSchema,
  execute: handleCreateActionRecord
};
