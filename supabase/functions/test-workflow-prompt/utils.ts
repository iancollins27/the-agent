
export function extractJsonFromResponse(response: string): any {
  try {
    // Try to parse the entire response as JSON
    return JSON.parse(response);
  } catch (e) {
    // If that fails, try to find JSON blocks in the response
    try {
      const jsonMatch = response.match(/```(?:json)?([\s\S]*?)```|(\{[\s\S]*\})/);
      if (jsonMatch) {
        const jsonString = (jsonMatch[1] || jsonMatch[2]).trim();
        return JSON.parse(jsonString);
      }
    } catch (innerError) {
      console.error("Error extracting JSON from response:", innerError);
    }
  }
  
  return null;
}

export function generateMockResult(promptType: string, contextData: any): string {
  // Generate a mock result for testing when the AI fails
  let mockResult = '';
  
  switch (promptType) {
    case 'action_detection':
    case 'action_detection_execution':
      mockResult = JSON.stringify({
        decision: "ACTION_NEEDED",
        reason: "This is a mock action detection and execution result",
        action_type: "message",
        message_text: "This is a mock message for testing purposes",
        action_payload: {
          message_text: "This is a mock message for testing purposes",
          reason: "This is a mock action detection and execution result"
        }
      }, null, 2);
      break;
      
    case 'summary_generation':
    case 'summary_update':
      mockResult = "This is a mock summary for testing purposes. The summary would normally contain relevant information about the project based on the provided context.";
      break;
      
    case 'multi_project_analysis':
      mockResult = JSON.stringify({
        projects: [
          {
            projectId: contextData.projects_data?.[0]?.id || "unknown",
            relevantContent: "This is mock relevant content for the first project",
            requiresAction: true
          }
        ]
      }, null, 2);
      break;
      
    case 'multi_project_message_generation':
      mockResult = `Hello ${contextData.rooferName || "Roofer"},

This is a mock consolidated message for multiple projects. In a real scenario, this would contain details about each project requiring your attention.

Thanks,
The Project Manager`;
      break;
      
    default:
      mockResult = "Mock result for " + promptType;
  }
  
  return mockResult;
}

/**
 * Replaces variable placeholders in a template string with values from contextData
 * 
 * @param template - String containing variables in the format {{variableName}}
 * @param contextData - Object containing values to replace the variables with
 * @returns The template with all variables replaced with their values
 */
export function replaceVariables(template: string, contextData: any): string {
  console.log("Starting replaceVariables with contextData keys:", Object.keys(contextData || {}));
  
  if (!template) {
    console.warn("Empty template provided to replaceVariables");
    return "";
  }
  
  if (!contextData || Object.keys(contextData).length === 0) {
    console.warn("No context data provided for variable replacement, returning template as is");
    return template;
  }
  
  let result = template;
  
  // Regular expression to find variables in the format {{variableName}}
  const variableRegex = /\{\{([^}]+)\}\}/g;
  
  // Helper function to get nested properties from an object by path
  const getNestedValue = (obj: any, path: string): any => {
    const parts = path.trim().split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  };
  
  // Find all variables in the template
  const variables: string[] = [];
  let match;
  while ((match = variableRegex.exec(template)) !== null) {
    variables.push(match[1].trim());
  }
  
  // Log all variables that will be replaced
  if (variables.length > 0) {
    console.log("Variables to replace:", variables.join(", "));
  }
  
  // Replace all variables in the template
  variableRegex.lastIndex = 0; // Reset regex index
  while ((match = variableRegex.exec(template)) !== null) {
    const fullMatch = match[0]; // {{variableName}}
    const variableName = match[1].trim(); // variableName
    
    // Get value from context data, handling nested properties
    const value = getNestedValue(contextData, variableName);
    
    // Format the value based on its type
    let formattedValue: string;
    if (value === undefined || value === null) {
      console.warn(`Variable ${variableName} not found in context data`);
      formattedValue = `[${variableName} not provided]`;
    } else if (typeof value === 'object') {
      try {
        formattedValue = JSON.stringify(value, null, 2);
      } catch (err) {
        console.error(`Error stringifying object value for ${variableName}:`, err);
        formattedValue = `[Error formatting ${variableName}]`;
      }
    } else {
      formattedValue = String(value);
    }
    
    console.log(`Replacing {{${variableName}}} with: ${typeof value === 'object' ? '[object]' : formattedValue.substring(0, 50) + (formattedValue.length > 50 ? '...' : '')}`);
    
    // Update the result, replacing just this occurrence
    // Need to use replace with a string, not regex, to avoid special char issues
    result = result.replace(fullMatch, formattedValue);
  }
  
  // Log the first 200 chars of the result for debugging
  console.log("Finished variable replacement, result starts with:", 
    result.substring(0, 200) + (result.length > 200 ? "..." : ""));
  
  return result;
}
