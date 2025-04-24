
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

export interface PromptRun {
  id: string;
  project_id?: string;
  workflow_prompt_id?: string;
  prompt_input: string;
  prompt_output?: string;
  error_message?: string;
  status: string;
  created_at: string;
  completed_at?: string;
  feedback_rating?: number;
  feedback_description?: string;
  feedback_tags?: string[];
  project_name?: string;
  project_address?: string;
  project_crm_url?: string;
  project_next_step?: string;
  project_roofer_contact?: string;
  workflow_prompt_type?: string;
  ai_provider?: string;
  ai_model?: string;
  workflow_type?: string;
  prompt_text?: string;
  result?: string;
  reviewed: boolean;
  pending_actions: number; // Added this field
  project_manager?: string | null; // Added this field
  pm_name?: string | null; // Added this field
}
