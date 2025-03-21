
import { Database } from "@/integrations/supabase/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface ActionRecord {
  id: string;
  project_id?: string;
  recipient_id?: string;
  sender_ID?: string;
  approver_id?: string;
  action_type: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  requires_approval: boolean;
  created_at: string;
  executed_at?: string;
  action_payload: {
    description?: string;
    field?: string;
    value?: string;
    recipient?: string;
    sender?: string;
    message_content?: string;
    notion_token?: string;
    notion_database_id?: string;
    notion_page_id?: string;
    days_until_check?: number;
    check_reason?: string;
    date?: string;
    [key: string]: any;
  };
  execution_result?: {
    success: boolean;
    message: string;
    [key: string]: any;
  };
  // UI-only properties
  recipient_name?: string;
  sender_name?: string;
  approver_name?: string;
  project_name?: string;
  recipient?: { id: string; full_name: string };
  sender?: { id: string; full_name: string };
}

export type PromptRun = {
  id: string;
  project_id: string;
  workflow_type: string;
  prompt_text: string;
  result: string;
  created_at: string;
  status: 'success' | 'error' | 'pending';
  error_message?: string;
  rating?: number;
  feedback?: string;
  ai_provider?: string;
  model?: string;
  project_name?: string;
  action_record_id?: string;
};

export type TimeFilterOption = 'all' | 'today' | 'week' | 'month';
