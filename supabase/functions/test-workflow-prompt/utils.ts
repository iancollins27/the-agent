
/**
 * Replaces variables in a text with values from a variables object
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
  let processedText = text;
  
  // Log the variables available for replacement
  console.log("Variables for replacement:", variables);
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    processedText = processedText.replace(regex, value);
  }
  
  // Log the final text after variable replacement
  console.log("Text after variable replacement:", processedText);
  
  return processedText;
}

/**
 * Generates mock result based on prompt type when API calls fail
 */
export function generateMockResult(promptType: string, contextData: Record<string, string>): string {
  switch (promptType) {
    case "summary_generation":
      return `This is a sample summary for a project in the ${contextData.track_name} track. Generated on ${contextData.current_date}. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "summary_update":
      return `Updated summary based on: "${contextData.summary}". Project is in the ${contextData.track_name} track. Last updated on ${contextData.current_date}. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "action_detection":
      return `Based on the summary "${contextData.summary}" for the ${contextData.track_name} track, here are some detected actions:\n1. Schedule a follow-up call\n2. Prepare project materials\n3. Review timeline. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "action_execution":
      return `For the action "${contextData.action_description}" on project with summary "${contextData.summary}" in the ${contextData.track_name} track, here are execution steps:\n1. Step one\n2. Step two\n3. Step three. ${contextData.milestone_instructions ? 'Using milestone instructions: ' + contextData.milestone_instructions : 'No milestone instructions available.'}`;
    case "action_detection_execution":
      return `{
  "decision": "ACTION_NEEDED",
  "message_text": "Hi, I noticed that you haven't updated your project. Would you like to schedule a call to discuss next steps?",
  "reason": "The project has been idle for 2 weeks and the next step '${contextData.next_step || "project milestone"}' requires client input.",
  "action_type": "message",
  "requires_approval": true,
  "action_payload": {
    "message_text": "Hi, I noticed that you haven't updated your project. Would you like to schedule a call to discuss next steps?",
    "reason": "The project has been idle for 2 weeks and the next step '${contextData.next_step || "project milestone"}' requires client input."
  }
}`;
    default:
      return "Unknown prompt type";
  }
}
