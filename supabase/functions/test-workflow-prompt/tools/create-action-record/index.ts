
/**
 * Main export for the create_action_record tool
 */
import { createActionRecordSchema, validateCreateActionRecordParams } from './schema';
import { handleCreateActionRecord } from './handler';
import { Tool } from '../types';
import { CreateActionRecordParams, CreateActionRecordResult } from './types';

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
} from './types';
