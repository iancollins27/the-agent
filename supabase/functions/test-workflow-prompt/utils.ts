/**
 * Replaces variables in a text with values from a variables object
 */
export function replaceVariables(promptText: string, contextData: Record<string, any>): string {
  let finalPrompt = promptText;
  
  // Log the variables found in the template
  const variables = (promptText.match(/\{\{([^}]+)\}\}/g) || [])
    .map(v => v.slice(2, -2));
  
  if (variables.length > 0) {
    console.log('Variables found in template:', variables);
  }
  
  // Log what context variables are available
  console.log('Context variables available:', Object.keys(contextData));
  
  // First flattening the context data to handle nested objects
  const flattenedData = flattenObject(contextData);
  console.log('Flattened context data:', Object.keys(flattenedData));
  
  // Replace each variable with its value
  variables.forEach(variable => {
    const varPattern = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
    
    // Check if variable exists in data
    if (variable in flattenedData) {
      const value = flattenedData[variable];
      const stringValue = typeof value === 'string' ? value : 
                          value === null ? '' : 
                          typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      finalPrompt = finalPrompt.replace(varPattern, stringValue || '');
      console.log(`Replaced {{${variable}}} with value (length: ${stringValue?.length || 0})`);
    } else if (variable in contextData) {
      // For direct matches in the top-level object
      const value = contextData[variable];
      const stringValue = typeof value === 'string' ? value : 
                          value === null ? '' : 
                          typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      finalPrompt = finalPrompt.replace(varPattern, stringValue || '');
      console.log(`Replaced {{${variable}}} with value (length: ${stringValue?.length || 0})`);
    } else {
      console.warn(`Variable {{${variable}}} not found in context data`);
      // If variable not found, replace with empty string or keep as is
      finalPrompt = finalPrompt.replace(varPattern, '');
    }
  });
  
  // Check for any remaining unreplaced variables
  const remainingVars = (finalPrompt.match(/\{\{([^}]+)\}\}/g) || [])
    .map(v => v.slice(2, -2));
  
  if (remainingVars.length > 0) {
    console.warn('Unreplaced variables in final prompt:', remainingVars);
  }
  
  return finalPrompt;
}

/**
 * Helper function to flatten nested objects for easier variable replacement
 * Example: { user: { name: 'John' } } becomes { 'user.name': 'John' }
 */
function flattenObject(obj: Record<string, any>, prefix: string = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively flatten nested objects
      Object.assign(flattened, flattenObject(value, newKey));
    } else {
      // Add non-object properties directly
      flattened[newKey] = value;
    }
    
    // Also add the key itself for direct matching
    flattened[key] = value;
  }
  
  return flattened;
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
    case 'multi_project_analysis':
      return JSON.stringify({
        projects: [
          {
            projectId: contextData.projects_data?.[0]?.id || "project-1",
            relevantContent: "This is a mock relevance analysis for the first project."
          },
          {
            projectId: contextData.projects_data?.[1]?.id || "project-2",
            relevantContent: "This is a mock relevance analysis for the second project."
          }
        ]
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
