
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
