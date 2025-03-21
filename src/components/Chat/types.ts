
import { Json } from "@/integrations/supabase/types";

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ActionRecord = {
  id: string;
  action_type: string;
  action_payload: {
    field?: string;
    value?: string;
    recipient?: string;
    sender?: string;
    message_content?: string;
    description: string;
    notion_token?: string;
    notion_database_id?: string;
    notion_page_id?: string;
    days_until_check?: number;
    check_reason?: string;
    date?: string;
  };
  status: string;
  approver_id?: string | null;
  created_at?: string;
  executed_at?: string | null;
  execution_result?: Json | null;
  project_id?: string | null;
  prompt_run_id?: string | null;
  requires_approval?: boolean;
  message?: string | null;
  recipient_id?: string | null;
  recipient?: { id: string, full_name: string } | null;
  recipient_name?: string;
  project_name?: string;
  sender_ID?: string | null; // Note the capitalized ID to match the database column
  sender?: { id: string, full_name: string } | null;
  sender_name?: string;
};
