
-- Add mcp_orchestrator to workflow_prompt_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type 
        JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'workflow_prompt_type' 
        AND pg_enum.enumlabel = 'mcp_orchestrator'
    ) THEN
        ALTER TYPE workflow_prompt_type ADD VALUE 'mcp_orchestrator';
    END IF;
END$$;

-- Create a function to create an MCP orchestrator prompt
CREATE OR REPLACE FUNCTION create_mcp_orchestrator_prompt(prompt_text TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_prompt_id UUID;
BEGIN
    -- Insert the new MCP orchestrator prompt
    INSERT INTO workflow_prompts (type, prompt_text)
    VALUES ('mcp_orchestrator', prompt_text)
    RETURNING id INTO new_prompt_id;
    
    RETURN new_prompt_id;
END;
$$;
