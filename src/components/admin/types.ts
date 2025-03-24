
import { Database } from "@/integrations/supabase/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface ActionRecord {
  id: string;
  project_id?: string;
  recipient_id?: string;
  sender_ID?: string; // Note the capital ID to match database column
  approver_id?: string;
  action_type: string;
  message: string | null;
  status: string; // Changed from union type to string to match database
  requires_approval: boolean;
  created_at: string;
  executed_at?: string | null;
  action_payload: Json;
  execution_result?: Json | null; // Changed to accept any Json structure
  // UI-only properties
  recipient_name?: string | null;
  sender_name?: string | null;
  approver_name?: string;
  project_name?: string | null;
  project_address?: string | null; // Added this property
  recipient?: { id: string; full_name: string } | null;
  sender?: { id: string; full_name: string } | null;
  projects?: { id: string; crm_id: string } | null;
}

export type TimeFilterOption = 'all' | 'today' | 'week' | 'month';

export type PromptRun = {
  id: string;
  project_id: string | null;
  workflow_type?: string;
  prompt_text?: string;
  result?: string;
  prompt_input?: string;
  prompt_output?: string | null;
  created_at: string;
  status: string;
  error_message?: string | null;
  rating?: number;
  feedback?: string;
  ai_provider?: string | null;
  ai_model?: string | null;
  project_name?: string;
  project_address?: string | null;
  project_crm_url?: string; // Added field for CRM URL
  action_record_id?: string;
  workflow_prompt_id?: string | null;
  workflow_prompt_type?: string;
  feedback_rating?: number | null;
  feedback_description?: string | null;
  feedback_tags?: string[] | null;
  completed_at?: string | null;
  initiated_by?: string;
};
