
import { Json } from "@/integrations/supabase/types";

export type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export type ContactInfo = {
  id: string;
  full_name: string;
  phone_number?: string;
  email?: string;
  role?: string;
};

export type ActionRecord = {
  id: string;
  action_type: string;
  action_payload: Json;
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
  recipient?: ContactInfo | null;
  recipient_name?: string | null;
  project_name?: string | null;
  project_address?: string | null;
  sender_ID?: string | null;
  sender?: ContactInfo | null;
  sender_name?: string | null;
};
