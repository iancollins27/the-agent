
-- Add provider and status fields to the communications table
ALTER TABLE public.communications 
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS provider_response JSONB,
ADD COLUMN IF NOT EXISTS error_details TEXT;

-- Check if direction column has the correct constraint, if not, fix it
DO $$
BEGIN
    -- First, try to drop the existing constraint if it exists
    BEGIN
        ALTER TABLE public.communications DROP CONSTRAINT IF EXISTS communications_direction_check;
    EXCEPTION WHEN OTHERS THEN
        -- Do nothing, constraint might not exist
    END;
    
    -- Add the constraint with the correct allowed values
    ALTER TABLE public.communications 
    ADD CONSTRAINT communications_direction_check 
    CHECK (direction IN ('INBOUND', 'OUTBOUND'));
END $$;

-- Add default comm provider settings to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS communication_settings JSONB DEFAULT '{"default_sms_provider": "justcall", "default_email_provider": "sendgrid", "default_call_provider": "justcall"}'::jsonb;
