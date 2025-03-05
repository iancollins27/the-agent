
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
    message_content?: string;
    description: string;
  };
  status: string;
  approver_id?: string | null;
  created_at?: string;
  executed_at?: string | null;
  execution_result?: Json | null;
  project_id?: string | null;
  prompt_run_id?: string | null;
  requires_approval?: boolean;
};
