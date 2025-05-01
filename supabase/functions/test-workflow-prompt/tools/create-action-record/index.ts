
/**
 * Main export for the create_action_record tool
 */
import { createActionRecordSchema, validateCreateActionRecordParams } from './schema.ts';
import { handleCreateActionRecord } from './handler.ts';
import { Tool } from '../types.ts';
import { CreateActionRecordParams, CreateActionRecordResult } from './types.ts';

export const createActionRecordTool: Tool<CreateActionRecordParams, CreateActionRecordResult> = {
  definition: createActionRecordSchema,
  handler: {
    execute: handleCreateActionRecord,
    validate: validateCreateActionRecordParams
  }
};

export { 
  CreateActionRecordParams, 
  CreateActionRecordResult,
  MessageActionParams,
  DataUpdateActionParams,
  ReminderActionParams,
  HumanReviewActionParams
} from './types.ts';
