
export type PromptRun = {
  id: string;
  project_id: string | null;
  workflow_prompt_id: string | null;
  prompt_input: string;
  prompt_output: string | null;
  feedback_description: string | null;
  feedback_tags: string[] | null;
  feedback_rating: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  project_name?: string;
  workflow_prompt_type?: string;
  ai_provider?: string | null;
  ai_model?: string | null;
};

export type ActionRecord = {
  id: string;
  prompt_run_id: string;
  project_id: string;
  action_type: 'message' | 'data_update' | 'request_for_data_update';
  action_payload: Record<string, any>;
  created_at: string;
  executed_at: string | null;
  approver_id: string | null;
  requires_approval: boolean;
  execution_result: Record<string, any> | null;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  project_name?: string;
  approver_name?: string;
};
