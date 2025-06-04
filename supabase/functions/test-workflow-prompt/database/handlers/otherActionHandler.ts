
/**
 * Handler for action types other than messages
 */
import { ToolContext, ToolResult } from '../../tools/types.ts';
import { handleFutureReminder } from './reminderHandler.ts';
import { handleEscalation } from './escalationHandler.ts';

/**
 * Handle non-message action types
 */
export async function handleOtherActionTypes(
  supabase: any,
  promptRunId: string,
  projectId: string,
  params: any,
  actionType: string
): Promise<ToolResult> {
  try {
    console.log(`Processing ${actionType} action with params:`, JSON.stringify(params, null, 2));

    switch (actionType) {
      case 'set_future_reminder':
        return await handleFutureReminder(supabase, promptRunId, projectId, params);
        
      case 'escalation':
        return await handleEscalation(supabase, promptRunId, projectId, params);
        
      case 'data_update':
        return await handleDataUpdate(supabase, promptRunId, projectId, params);
        
      case 'human_in_loop':
        return await handleHumanInLoop(supabase, promptRunId, projectId, params);
        
      case 'knowledge_query':
        return await handleKnowledgeQuery(supabase, promptRunId, projectId, params);
        
      default:
        console.warn(`Unknown action type: ${actionType}`);
        return {
          status: "error",
          error: `Unsupported action type: ${actionType}`
        };
    }
  } catch (error) {
    console.error(`Error in handleOtherActionTypes for ${actionType}:`, error);
    return {
      status: "error",
      error: error.message || "Unknown error processing action"
    };
  }
}

/**
 * Handle data update actions
 */
async function handleDataUpdate(
  supabase: any,
  promptRunId: string,
  projectId: string,
  params: any
): Promise<ToolResult> {
  try {
    const { data: actionRecord, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'data_update',
        action_payload: {
          field: params.data_field || params.field,
          value: params.data_value || params.value,
          description: params.description || `Update ${params.data_field || params.field} to ${params.data_value || params.value}`
        },
        requires_approval: true,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create data update action: ${error.message}`);
    }

    return {
      status: "success",
      action_record_id: actionRecord.id,
      message: "Data update action created and requires approval"
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message
    };
  }
}

/**
 * Handle human in loop actions
 */
async function handleHumanInLoop(
  supabase: any,
  promptRunId: string,
  projectId: string,
  params: any
): Promise<ToolResult> {
  try {
    const { data: actionRecord, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'human_in_loop',
        action_payload: {
          reason: params.reason || 'Human review requested',
          description: params.description || 'This project requires human intervention',
          priority: params.priority || 'medium'
        },
        requires_approval: true,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create human in loop action: ${error.message}`);
    }

    return {
      status: "success",
      action_record_id: actionRecord.id,
      message: "Human in loop action created and requires approval"
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message
    };
  }
}

/**
 * Handle knowledge query actions
 */
async function handleKnowledgeQuery(
  supabase: any,
  promptRunId: string,
  projectId: string,
  params: any
): Promise<ToolResult> {
  try {
    const { data: actionRecord, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'knowledge_query',
        action_payload: {
          query: params.query || params.question,
          context: params.context,
          description: params.description || `Knowledge base query: ${params.query || params.question}`
        },
        requires_approval: false,
        status: 'executed',
        executed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create knowledge query action: ${error.message}`);
    }

    return {
      status: "success",
      action_record_id: actionRecord.id,
      message: "Knowledge query action recorded"
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message
    };
  }
}
