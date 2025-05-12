
/**
 * MCP system prompts
 */

/**
 * Generates the MCP orchestrator prompt for use with the MCP
 * @param toolNames List of available tool names
 * @param milestoneInstructions Milestone-specific instructions
 * @param customPrompt Custom orchestrator prompt from the database
 * @param contextData Context data for the MCP
 * @returns The formatted MCP orchestrator prompt
 */
export function getMCPOrchestratorPrompt(
  toolNames: string[],
  milestoneInstructions: string | null,
  customPrompt: string | null,
  contextData: Record<string, any>
): string {
  // If we have a custom prompt from the database, use that as the base
  if (customPrompt) {
    // Replace variables in the custom prompt
    let formattedPrompt = customPrompt;
    
    // Try to replace common variables in the prompt
    const variablesToReplace = {
      '{{available_tools}}': toolNames.join(', '),
      '{{milestone_instructions}}': milestoneInstructions || 'No specific milestone instructions available.',
      '{{property_address}}': contextData.property_address || '[No property address provided]',
      '{{current_date}}': contextData.current_date || new Date().toISOString().split('T')[0],
      '{{track_name}}': contextData.track_name || 'Default Track',
      '{{track_base_prompt}}': contextData.track_base_prompt || '',
      '{{track_roles}}': contextData.track_roles || '',
      '{{next_step}}': contextData.next_step || '',
      '{{summary}}': contextData.summary || '[No project summary provided]',
      '{{project_id}}': contextData.project_id || 'unknown',
      '{{project_contacts}}': contextData.formattedContacts || '[No contacts available]',
    };
    
    // Replace each variable
    Object.entries(variablesToReplace).forEach(([variable, value]) => {
      formattedPrompt = formattedPrompt.replace(new RegExp(variable, 'g'), value);
    });
    
    return formattedPrompt;
  }
  
  // Default orchestrator prompt if no custom prompt is provided
  return `You are an AI orchestrator using the Model Context Protocol. Your task is to analyze a project summary and determine if any actions should be taken.

Project Summary:
${contextData.summary || '[No project summary provided]'}

Project ID: ${contextData.project_id || 'unknown'}
Project Track: ${contextData.track_name || 'Default Track'}
Track Roles: ${contextData.track_roles || ''}
Next Step: ${contextData.next_step || ''}
Current Date: ${contextData.current_date || new Date().toISOString().split('T')[0]}
Property Address: ${contextData.property_address || '[No property address provided]'}

Project Contacts:
${contextData.formattedContacts || 'No contacts available for this project.'}

Available Tools:
${toolNames.join(', ')}

Milestone-Specific Instructions:
${milestoneInstructions || 'No specific milestone instructions available.'}

Track-Level Instructions:
${contextData.track_base_prompt || ''}

Follow these steps:
1. Analyze the project summary and current state
2. Determine if any action is needed based on:
   - The milestone instructions
   - The current next step
   - The project summary
   - Any other relevant context
3. If action is needed, use the appropriate tool (data_fetch, create_action_record, knowledge_base_lookup)
4. Be specific in your reasoning and provide clear explanations

IMPORTANT CONTACT HANDLING:
When creating message actions:
- Reference the contacts by their ID using the 'sender_ID' and 'recipient_id' parameters
- Always include the message content in the 'message' parameter
- Remember to include appropriate details about what the message is about and why it's needed

When using the data_fetch tool, make sure to use the project_id provided above.

Always think step by step and provide clear reasoning for your decisions.`;
}
