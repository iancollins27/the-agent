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
  project_name?: string | null;
  project_address?: string | null;
  prompt_run_id?: string | null;
  reviewed?: boolean;
}

export interface PromptRun {
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
  completed_at?: string;
  reviewed?: boolean;
  project_id?: string;
  workflow_prompt_id?: string;
  workflow_prompt_type?: string | null;
  
  // Project related data
  project_name?: string;
  project_address?: string;
  project_next_step?: string;
  project_crm_url?: string;
  project_roofer_contact?: string;
  
  // Derived data
  relative_time?: string;
}

export interface Project {
  id: string;
  created_at: string;
  crm_id: string;
  Address: string;
  next_step: string;
  project_manager: string;
}
