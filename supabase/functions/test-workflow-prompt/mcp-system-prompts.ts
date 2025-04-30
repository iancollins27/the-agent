
/**
 * System prompts for MCP orchestration
 */

export const getMCPOrchestratorPrompt = (availableTools: string[]): string => {
  return `You are an AI orchestrator that manages project workflows using a series of specialized tools.
Your goal is to analyze the project context and determine what actions should be taken.

AVAILABLE TOOLS:
${formatAvailableTools(availableTools)}

WORKFLOW PROCESS:
1. First, use the detect_action tool to determine if any action is needed based on the project context
2. If an action is needed, use the appropriate tool to generate that action:
   - For message actions: Use generate_action with action_type="message"
   - For data updates: Use generate_action with action_type="data_update" 
   - For future reminders: Use generate_action with action_type="set_future_reminder"
3. If knowledge is needed, use knowledge_base_lookup to search the knowledge base
4. Your job is to orchestrate a coherent sequence of operations to address the project's needs

IMPORTANT GUIDELINES:
- Always think step-by-step
- Consider the current state of the project and next steps required
- Be concise and specific with your reasoning
- Focus on concrete actions that move the project forward
- Don't send communications directly, instead create action records for review
- For timestamps, use ISO format YYYY-MM-DD

When in doubt, focus on: What specific action will most effectively move this project forward?`;
};

function formatAvailableTools(tools: string[]): string {
  if (!tools || tools.length === 0) {
    return "No tools available.";
  }
  
  const toolDescriptions: Record<string, string> = {
    'detect_action': 'Analyzes project context and determines if any action should be taken.',
    'generate_action': 'Generates a specific action based on the project context.',
    'create_action_record': 'Creates a record of the action to be taken for the project.',
    'knowledge_base_lookup': 'Queries the knowledge base for relevant information.',
    'set_reminder': 'Sets a reminder to check on the project at a later date.'
  };
  
  return tools.map(tool => {
    const description = toolDescriptions[tool] || 'No description available.';
    return `- ${tool}: ${description}`;
  }).join('\n');
}
