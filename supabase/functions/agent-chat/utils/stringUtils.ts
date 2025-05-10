
/**
 * Replaces variable placeholders in a template string with values from contextData
 * 
 * @param template - String containing variables in the format {{variableName}}
 * @param contextData - Object containing values to replace the variables with
 * @returns The template with all variables replaced with their values
 */
export function replaceVariables(template: string, contextData: any): string {
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
    
    // Update the result, replacing just this occurrence
    result = result.replace(fullMatch, formattedValue);
  }
  
  return result;
}
