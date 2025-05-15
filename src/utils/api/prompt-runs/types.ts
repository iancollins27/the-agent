
// Define a type for our database result with the additional roofer_contact property
export interface PromptRunWithRoofer extends Record<string, any> {
  id: string;
  created_at: string;
  status: string;
  ai_provider: string;
  ai_model: string;
  prompt_input: string;
  prompt_output?: string;
  error_message?: string;
  feedback_rating?: number;
  feedback_description?: string;
  feedback_tags?: string[];
  feedback_review?: string;
  completed_at?: string;
  reviewed?: boolean;
  project_id?: string;
  workflow_prompt_id?: string;
  workflow_prompt_type?: string | null;
  project_name?: string;
  project_address?: string;
  project_next_step?: string;
  project_crm_url?: string;
  project_roofer_contact?: string | null;
  roofer_contact?: string | null; // Add this as well for compatibility
  project_manager?: string;
  relative_time?: string;
  workflow_type?: string | null;
  error?: boolean;
  toolLogsCount?: number;
}

export interface RerunPromptResult {
  success: boolean;
  newPromptRunId?: string;
  error?: string;
}
