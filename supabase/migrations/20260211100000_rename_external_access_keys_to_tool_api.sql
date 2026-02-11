-- Rename external access key table from MCP-oriented naming to Tool API naming.
-- This preserves all data and existing permissions.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'mcp_external_access_keys'
  ) THEN
    ALTER TABLE public.mcp_external_access_keys RENAME TO tool_external_access_keys;
  END IF;
END $$;

-- Rename indexes if they exist.
ALTER INDEX IF EXISTS public.idx_mcp_external_access_keys_key_hash
  RENAME TO idx_tool_external_access_keys_key_hash;

ALTER INDEX IF EXISTS public.idx_mcp_external_access_keys_company_id
  RENAME TO idx_tool_external_access_keys_company_id;

-- Rename FK constraints if they exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tool_external_access_keys'
      AND constraint_name = 'mcp_external_access_keys_company_id_fkey'
  ) THEN
    ALTER TABLE public.tool_external_access_keys
      RENAME CONSTRAINT mcp_external_access_keys_company_id_fkey
      TO tool_external_access_keys_company_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'tool_external_access_keys'
      AND constraint_name = 'mcp_external_access_keys_created_by_fkey'
  ) THEN
    ALTER TABLE public.tool_external_access_keys
      RENAME CONSTRAINT mcp_external_access_keys_created_by_fkey
      TO tool_external_access_keys_created_by_fkey;
  END IF;
END $$;

-- Update table comment.
COMMENT ON TABLE public.tool_external_access_keys IS
'Stores API keys for external tool API clients. Keys are hashed using SHA-256.';

