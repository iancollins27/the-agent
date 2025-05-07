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
  approver_name?: string | null;
  // Include recipient and sender for nested objects from database joins
  recipient?: {
    id: string;
    full_name: string;
    phone_number: string;
    email: string;
  } | null;
  sender?: {
    id: string;
    full_name: string;
    phone_number: string;
    email: string;
  } | null;
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
  feedback_review?: string;
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
  project_manager?: string;
  
  // Derived data
  relative_time?: string;
  workflow_type?: string | null;
  
  // Alternate field names that might be used in some components
  prompt_text?: string;
  result?: string;
  
  // Tool logs related data
  toolLogsCount?: number;
}

export type WorkflowType = 
  | 'summary_generation' 
  | 'summary_update' 
  | 'action_detection' 
  | 'action_execution' 
  | 'action_detection_execution' 
  | 'multi_project_analysis' 
  | 'multi_project_message_generation'
  | 'mcp_orchestrator';

export const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: 'Summary Generation',
  summary_update: 'Summary Update',
  action_detection: 'Action Detection',
  action_execution: 'Action Execution',
  action_detection_execution: 'Action Detection & Execution',
  multi_project_analysis: 'Multi-Project Analysis',
  multi_project_message_generation: 'Multi-Project Message',
  mcp_orchestrator: 'MCP Orchestrator'
};
