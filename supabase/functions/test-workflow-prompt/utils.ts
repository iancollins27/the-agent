
/**
 * Replaces variables in a text with values from a variables object
 */
export function replaceVariables(text: string, variables: Record<string, any>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const trimmedVar = variable.trim();
    return variables[trimmedVar] !== undefined ? variables[trimmedVar] : match;
  });
}

/**
 * Generate a mock result for testing purposes
 */
export function generateMockResult(promptType: string, contextData: any): string {
  switch (promptType) {
    case 'summary_generation':
      return `Project Summary: This is a mock summary for a ${contextData.track_name || 'unknown'} project.`;
    case 'summary_update':
      return `Updated Project Summary: This is a mock updated summary for a ${contextData.track_name || 'unknown'} project.`;
    case 'action_detection':
      return JSON.stringify({
        decision: 'ACTION_NEEDED',
        reason: 'This is a mock action detection result',
        action_type: 'message',
        message_text: 'This is a mock message for testing purposes',
      }, null, 2);
    case 'action_execution':
      return JSON.stringify({
        success: true,
        message: 'Mock action execution completed',
      }, null, 2);
    case 'action_detection_execution':
      return JSON.stringify({
        decision: 'ACTION_NEEDED',
        reason: 'This is a mock action detection and execution result',
        action_type: 'message',
        message_text: 'This is a mock message for testing purposes',
        action_payload: {
          message_text: 'This is a mock message for testing purposes',
          reason: 'This is a mock action detection and execution result',
        }
      }, null, 2);
    default:
      return 'Mock result for unknown prompt type';
  }
}

/**
 * Utility to help extract JSON from a response that might contain additional text
 */
export function extractJsonFromResponse(response: string): any | null {
  try {
    // First try direct parsing
    return JSON.parse(response);
  } catch (error) {
    // If direct parsing fails, try to extract JSON from the response
    try {
      // Look for JSON in markdown code blocks (```json ... ```)
      const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        return JSON.parse(codeBlockMatch[1]);
      }
      
      // If no code block, try to find any JSON object in the string
      const jsonRegex = /\{[\s\S]*\}/;
      const match = response.match(jsonRegex);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (innerError) {
      console.error("Error extracting JSON from response:", innerError);
    }
    return null;
  }
}
