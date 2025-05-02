
/**
 * System prompts for MCP orchestration
 */
import { replaceVariables } from "./utils.ts";

export const getMCPOrchestratorPrompt = (
  availableTools: string[], 
  milestoneInstructions?: string,
  customPromptText?: string,
  contextData?: any
): string => {
  // If no context data is provided, we can't do variable replacement
  if (!contextData) {
    console.warn("No context data provided for variable replacement in MCP orchestrator prompt");
  }

  // If a custom prompt text is provided, use it instead of the default
  if (customPromptText) {
    console.log("Using custom orchestrator prompt text");
    
    // Do variable replacement on the custom prompt if context data is available
    let finalPrompt = contextData ? replaceVariables(customPromptText, contextData) : customPromptText;
    
    console.log("Finished variable replacement, result starts with:", finalPrompt.substring(0, 200) + "...");
    
    // Check if milestone instructions section is already included in the template after variable replacement
    const hasMilestoneInstructions = finalPrompt.includes('MILESTONE INSTRUCTIONS:');
    
    // Check if available tools section is already included in the template after variable replacement
    const hasAvailableTools = finalPrompt.includes('AVAILABLE TOOLS:');
    
    // Add milestone instructions section if not already included in the custom prompt
    // and milestones are provided
    if (!hasMilestoneInstructions && milestoneInstructions) {
      console.log("Adding milestone instructions section (not found in template)");
      const milestoneSection = `
MILESTONE INSTRUCTIONS:
${milestoneInstructions}

Please consider these milestone-specific instructions when analyzing the project and determining actions.
`;
      finalPrompt += milestoneSection;
    } else if (hasMilestoneInstructions) {
      console.log("Skipping milestone instructions section (already present in template)");
    }
    
    // Format available tools if not already included in the prompt after variable replacement
    if (!hasAvailableTools && availableTools.length > 0) {
      console.log("Adding available tools section (not found in template)");
      const toolsSection = `
AVAILABLE TOOLS:
${formatAvailableTools(availableTools)}
`;
      finalPrompt += toolsSection;
    } else if (hasAvailableTools) {
      console.log("Skipping available tools section (already present in template)");
    }
    
    return finalPrompt;
  }

  // Default prompt if no custom prompt is provided
  const milestoneSection = milestoneInstructions 
    ? `
MILESTONE INSTRUCTIONS:
${milestoneInstructions}

Please consider these milestone-specific instructions when analyzing the project and determining actions.
`
    : '';

  const defaultPromptTemplate = `You are an AI orchestrator that manages project workflows using a series of specialized tools.
Your goal is to analyze the project context and determine what actions should be taken.

AVAILABLE TOOLS:
${formatAvailableTools(availableTools)}

${milestoneSection}
WORKFLOW PROCESS:
1. First, analyze the project context and determine if any action is needed
2. If action is needed, use the create_action_record tool to create that action
3. For data queries, use knowledge_base_lookup to search the knowledge base
4. Your job is to make decisions and then use tools to implement those decisions

ACTION CREATION GUIDELINES:
- When creating message actions, write specific, actionable messages tailored to the recipient's role
- Never create generic messages like "Please review" or "Action needed" - be specific about what needs to be done
- Always select the most appropriate recipient based on their role in the project
- Messages should be written in a professional, clear tone as if they will be sent directly to the recipient
- Do not include technical instructions or system notes in message content
- For messages, identify the correct recipient (e.g., Homeowner, Project Manager, Roofer) based on the context
- Do not include a description field unless absolutely necessary
- Do not create more than one action for the same purpose

DECISION MAKING GUIDELINES:
- Analyze the project state and determine if action is needed
- Consider the type of action needed: message, data_update, set_future_reminder, human_in_loop, or knowledge_query
- If no action is needed, explicitly state that and provide your reasoning
- If a reminder should be set for a future date, use create_action_record with action_type: "set_future_reminder"

IMPORTANT GUIDELINES:
- Always think step-by-step
- Consider the current state of the project and next steps required
- Be concise and specific with your reasoning
- Each tool must be called separately as an individual tool call
- Tool calls must be made sequentially, waiting for each tool's response before making the next call
- Don't send communications directly, instead create action records for review
- For timestamps, use ISO format YYYY-MM-DD
- For message actions, ALWAYS specify both the sender and recipient
- When creating message actions, the sender should always be "BidList Project Manager" unless otherwise specified
- NEVER call the same tool with the same parameters more than once
- NEVER create duplicate action records for the same purpose
- AVOID INFINITE LOOPS: Do not create multiple similar actions - if you've already created an action for a specific purpose, DO NOT create another one

TOOL CALL RULES:
- ALWAYS make each tool call separately, not as a batch
- Include all required parameters for each tool call
- Wait for the response from each tool call before proceeding to the next action
- Never attempt to execute two tool calls at once

When in doubt, focus on: What specific action will most effectively move this project forward?`;

  // Return the default prompt (no variable replacement needed as it's hardcoded)
  return defaultPromptTemplate;
};

function formatAvailableTools(tools: string[]): string {
  if (!tools || tools.length === 0) {
    return "No tools available.";
  }
  
  const toolDescriptions: Record<string, string> = {
    'create_action_record': 'Creates a specific action record based on your analysis. Use this to implement your decisions about what action should be taken.',
    'knowledge_base_lookup': 'Queries the knowledge base for relevant information.',
    'generate_action': 'Creates a specific action for team members to execute. Similar to create_action_record but with slightly different parameters.'
  };
  
  return tools.map(tool => {
    const description = toolDescriptions[tool] || 'No description available.';
    return `- ${tool}: ${description}`;
  }).join('\n');
}
