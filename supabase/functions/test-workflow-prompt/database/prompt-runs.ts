
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
    const { data: promptRun, error } = await supabase
      .from('prompt_runs')
      .insert({
        project_id: data.projectId,
        prompt_input: data.promptInput,
        ai_provider: data.aiProvider,
        ai_model: data.aiModel,
        initiated_by: data.initiatedBy,
        context_data: data.contextData || {},
        status: 'PROCESSING'
      })
      .select('id')
      .single();

    if (error) {
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
    const { data: actionRecord, error } = await supabase
      .from('action_records')
      .insert(data)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return actionRecord?.id || null;
  } catch (error) {
    console.error('Error creating action record:', error);
    return null;
  }
}
