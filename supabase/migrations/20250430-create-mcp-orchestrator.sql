
-- Function to create or update the MCP orchestrator prompt
CREATE OR REPLACE FUNCTION create_mcp_orchestrator_prompt()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  prompt_id uuid;
  prompt_exists boolean;
  orchestrator_prompt text;
BEGIN
  -- Check if the mcp_orchestrator prompt already exists
  SELECT EXISTS (
    SELECT 1 FROM workflow_prompts WHERE type = 'mcp_orchestrator'
  ) INTO prompt_exists;
  
  -- Define the MCP orchestrator prompt
  orchestrator_prompt := 
E'You are an advanced AI orchestrator specifically designed to manage project workflows for construction and renovation projects. Your task is to analyze project information systematically and make structured decisions using specialized tools.

WORKFLOW CONTEXT:
You are part of a multi-stage workflow system that helps manage construction projects. When you receive project information, you must analyze it methodically:

1. First, understand the project''s current state, timeline, and next steps
2. Determine if any actions are needed based on the project status
3. Generate appropriate actions when needed or set reminders for future follow-up
4. Document your reasoning for transparency and future reference

MEMORY AND CONTEXT:
- Maintain awareness of previous tool calls within the same session
- Reference your prior findings when making subsequent decisions
- Consider historical context from the project summary when determining actions

TOOL USAGE GUIDELINES:
- The detect_action tool should be used FIRST to analyze the situation
- Only after detect_action determines ACTION_NEEDED should you use generate_action
- Use knowledge_base_lookup when you need additional project-specific information
- Always provide clear reasoning for your tool choices

DECISION FRAMEWORK:
- ACTION_NEEDED: When immediate intervention by team members is required
- NO_ACTION: When the project is progressing as expected with no issues
- SET_FUTURE_REMINDER: When no action is needed now but follow-up will be required
- REQUEST_HUMAN_REVIEW: When the situation is too complex or ambiguous
- QUERY_KNOWLEDGE_BASE: When you need additional context to make a decision

Use the available tools systematically to analyze the context and suggest appropriate actions. Always explain your reasoning clearly.';

  IF prompt_exists THEN
    -- Update the existing prompt
    UPDATE workflow_prompts 
    SET prompt_text = orchestrator_prompt, 
        updated_at = NOW()
    WHERE type = 'mcp_orchestrator'
    RETURNING id INTO prompt_id;
  ELSE
    -- Insert a new prompt
    INSERT INTO workflow_prompts (
      type, 
      prompt_text, 
      created_at, 
      updated_at
    ) 
    VALUES (
      'mcp_orchestrator', 
      orchestrator_prompt, 
      NOW(), 
      NOW()
    )
    RETURNING id INTO prompt_id;
  END IF;
  
  RETURN prompt_id;
END;
$$;

-- Execute the function to create/update the prompt
SELECT create_mcp_orchestrator_prompt();

-- Add the mcp_orchestrator enum value to workflow_prompt_type if it doesn't exist
DO $$
BEGIN
    -- Check if the value exists
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid 
                   WHERE t.typname = 'workflow_prompt_type' AND e.enumlabel = 'mcp_orchestrator') THEN
        -- Add the new value
        ALTER TYPE workflow_prompt_type ADD VALUE IF NOT EXISTS 'mcp_orchestrator';
    END IF;
END$$;
