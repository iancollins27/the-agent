
import { ToolContext } from '../../tools/types.ts';
import { executeEmailSummaryFunction } from './handler.ts';
import { schema } from './schema.ts';

export const emailSummaryTool = {
  name: 'email_summary',
  description: 'Fetches and summarizes emails related to a project and updates the project with the summary',
  schema,
  execute: async (args: any, context: ToolContext) => {
    return await executeEmailSummaryFunction(args, context);
  }
};
