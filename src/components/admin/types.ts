
export interface PromptRun {
  id: string;
  project_id?: string;
  project_name?: string;
  project_address?: string;
  project_manager?: string;
  project_roofer_contact?: string | null;
  project_crm_url?: string | null;
  prompt_text?: string;
  result?: string;
  feedback_rating?: number | null;
  feedback_description?: string | null;
  feedback_tags?: string[] | null;
  reviewed?: boolean;
  created_at: string;
  project_next_step?: string;
  workflow_type?: string;
  prompt_input?: string;
  prompt_output?: string;
  error_message?: string;
}

export interface ActionRecord {
  id: string;
  project_id?: string;
  recipient_id?: string;
  sender_ID?: string;
  approver_id?: string;
  action_type: string;
  message: string | null;
  status: string;
  requires_approval: boolean;
  created_at: string;
  executed_at?: string | null;
  action_payload: any;
  execution_result?: any | null;
  recipient_name?: string | null;
  sender_name?: string | null;
  approver_name?: string | null;
  project_name?: string | null;
  project_address?: string | null;
}
