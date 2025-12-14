-- Add agent configuration columns to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS agent_phone_number TEXT,
ADD COLUMN IF NOT EXISTS agent_name TEXT;

COMMENT ON COLUMN companies.agent_phone_number IS 'The phone number used for outbound agent communications via Twilio';
COMMENT ON COLUMN companies.agent_name IS 'The display name for the agent (defaults to "{Company Name} Agent" if not set)';