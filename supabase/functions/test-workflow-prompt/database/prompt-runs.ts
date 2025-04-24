
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type PromptRunData = {
  projectId: string;
  promptInput: string;
  aiProvider: string;
  aiModel: string;
  initiatedBy: string;
  contextData?: any;
};

/**
 * Log a new prompt run in the database
 */
export async function logPromptRun(data: PromptRunData): Promise<string | null> {
  try {
    // Map the input data to match the database column names
    const { data: promptRun, error } = await supabase
      .from('prompt_runs')
      .insert({
        project_id: data.projectId,
        prompt_input: data.promptInput,
        ai_provider: data.aiProvider,
        ai_model: data.aiModel,
        initiated_by: data.initiatedBy,
        // Remove the context_data field as it doesn't exist in the schema
        status: 'PROCESSING'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error in logPromptRun:', error);
      throw error;
    }

    return promptRun?.id || null;
  } catch (error) {
    console.error('Error logging prompt run:', error);
    return null;
  }
}

/**
 * Create a new action record
 */
export async function createActionRecord(data: any): Promise<string | null> {
  try {
    // Ensure we're using action_payload instead of actionPayload
    // Map the data to match the column name in the database
    const { data: actionRecord, error } = await supabase
      .from('action_records')
      .insert({
        ...data,
        // If data contains actionPayload, rename it to action_payload
        action_payload: data.actionPayload || data.action_payload,
        // Delete the actionPayload property if it exists to avoid conflicts
        ...(data.actionPayload && { actionPayload: undefined })
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error in createActionRecord:', error);
      throw error;
    }

    return actionRecord?.id || null;
  } catch (error) {
    console.error('Error creating action record:', error);
    return null;
  }
}
