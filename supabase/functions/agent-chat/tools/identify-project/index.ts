
import { ToolContext } from '../types.ts';
import { executeIdentifyProject } from './handler.ts';
import { identifyProjectSchema } from './schema.ts';

export const identifyProjectTool = {
  name: 'identify_project',
  description: 'Identifies and retrieves project information based on search criteria like address, project name, or CRM ID. Returns project details and associated contacts.',
  schema: identifyProjectSchema,
  execute: async (args: any, context: ToolContext) => {
    return await executeIdentifyProject(args, context);
  }
};
