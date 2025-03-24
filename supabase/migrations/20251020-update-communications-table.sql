
-- Add provider and status fields to the communications table
ALTER TABLE public.communications 
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS provider_response JSONB,
ADD COLUMN IF NOT EXISTS error_details TEXT;

-- Add default comm provider settings to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS communication_settings JSONB DEFAULT '{"default_sms_provider": "justcall", "default_email_provider": "sendgrid", "default_call_provider": "justcall"}'::jsonb;
