
/**
 * Handler for create-action-record tool
 */
import { ToolContext, ToolResult } from '../types.ts';
import { createActionRecord } from '../../database/actions.ts';

export async function handleCreateActionRecord(args: any, context: ToolContext): Promise<ToolResult> {
  const { supabase, promptRunId, projectId } = context;
  
  // Call the database function to create the action record
  return await createActionRecord(supabase, promptRunId, projectId, args);
}
