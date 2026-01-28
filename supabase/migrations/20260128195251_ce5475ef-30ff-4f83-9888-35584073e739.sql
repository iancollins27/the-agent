-- Create table for MCP external access keys
-- This table authenticates external AI agents connecting via MCP protocol
CREATE TABLE public.mcp_external_access_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_name TEXT NOT NULL,
  enabled_tools TEXT[] NOT NULL DEFAULT ARRAY['crm_read', 'crm_write'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create index for fast key lookups
CREATE INDEX idx_mcp_external_access_keys_key_hash ON public.mcp_external_access_keys(key_hash);

-- Create index for company lookups
CREATE INDEX idx_mcp_external_access_keys_company_id ON public.mcp_external_access_keys(company_id);

-- Enable RLS
ALTER TABLE public.mcp_external_access_keys ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (needed for edge function)
CREATE POLICY "Service role can do everything on mcp_external_access_keys"
ON public.mcp_external_access_keys
AS RESTRICTIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view keys for their company
CREATE POLICY "Users can view mcp_external_access_keys for their company"
ON public.mcp_external_access_keys
FOR SELECT
TO authenticated
USING (company_id = get_user_company_id());

-- Users can insert keys for their company
CREATE POLICY "Users can insert mcp_external_access_keys for their company"
ON public.mcp_external_access_keys
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_user_company_id());

-- Users can update keys for their company
CREATE POLICY "Users can update mcp_external_access_keys for their company"
ON public.mcp_external_access_keys
FOR UPDATE
TO authenticated
USING (company_id = get_user_company_id());

-- Users can delete keys for their company
CREATE POLICY "Users can delete mcp_external_access_keys for their company"
ON public.mcp_external_access_keys
FOR DELETE
TO authenticated
USING (company_id = get_user_company_id());

-- Add comment to table
COMMENT ON TABLE public.mcp_external_access_keys IS 'Stores API keys for external AI agents connecting via MCP protocol. Keys are hashed using SHA-256.';