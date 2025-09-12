
export interface RooferContact {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface PromptRunUI {
  id: string;
  created_at: string;
  status: string;
  ai_provider: string;
  ai_model: string;
  prompt_input: string;
  prompt_output?: string | null;
  error_message?: string | null;
  feedback_rating?: number | null;
  feedback_description?: string | null;
  feedback_tags?: string[] | null;
  feedback_review?: string | null;
  completed_at?: string | null;
  reviewed: boolean;
  project_id?: string | null;
  workflow_prompt_id?: string | null;
  workflow_prompt_type?: string | null;
  project_name?: string | null;
  project_address?: string | null;
  project_next_step?: string | null;
  project_crm_url?: string | null;
  project_roofer_contact?: string | null;
  project_manager?: string | null;
  relative_time: string;
  workflow_type?: string | null;
  error: boolean;
  toolLogsCount?: number;
  isReminderTriggered?: boolean;
}
