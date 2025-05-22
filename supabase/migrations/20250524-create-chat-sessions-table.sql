
-- Create chat_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type TEXT NOT NULL,
  channel_identifier TEXT NOT NULL,
  contact_id UUID,
  company_id UUID NOT NULL,
  project_id UUID,
  memory_mode TEXT DEFAULT 'standard',
  conversation_history JSONB[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_channel 
ON public.chat_sessions(channel_type, channel_identifier);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_company 
ON public.chat_sessions(company_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_active_expires 
ON public.chat_sessions(active, expires_at);
