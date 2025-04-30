
-- Add mcp_orchestrator to the workflow_prompt_type enum
ALTER TYPE workflow_prompt_type ADD VALUE IF NOT EXISTS 'mcp_orchestrator';

-- Create a function to create an MCP orchestrator prompt (workaround for TypeScript limitations)
CREATE OR REPLACE FUNCTION create_mcp_orchestrator_prompt(p_prompt_text TEXT)
RETURNS SETOF workflow_prompts AS $$
BEGIN
  RETURN QUERY
  INSERT INTO workflow_prompts (prompt_text, type)
  VALUES (p_prompt_text, 'mcp_orchestrator')
  RETURNING *;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
