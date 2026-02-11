-- Rename workflow enum/value from mcp_orchestrator to tool_orchestrator.
-- Also backfill workflow_prompts rows for environments where type may be text.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = 'public'
      AND t.typname = 'workflow_type'
      AND e.enumlabel = 'mcp_orchestrator'
  ) THEN
    ALTER TYPE public.workflow_type
      RENAME VALUE 'mcp_orchestrator' TO 'tool_orchestrator';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workflow_prompts'
      AND column_name = 'type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.workflow_prompts
      SET type = 'tool_orchestrator'
      WHERE type::text = 'mcp_orchestrator'
    $sql$;
  END IF;
END $$;

