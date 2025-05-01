
/**
 * Validate that the conversation context has the proper structure
 * This helps catch issues with missing tool responses
 */
export function validateContextStructure(context: any) {
  // Check that each tool call has a corresponding response
  const missingResponses = [];
  
  for (let i = 0; i < context.messages.length; i++) {
    const message = context.messages[i];
    if (message.role === "assistant" && message.tool_calls) {
      for (const toolCall of message.tool_calls) {
        const hasResponse = context.messages.some(
          m => m.role === "tool" && m.tool_call_id === toolCall.id
        );
        
        if (!hasResponse) {
          console.error(`Missing tool response for tool_call_id: ${toolCall.id}`);
          missingResponses.push(toolCall.id);
        }
      }
    }
  }
  
  if (missingResponses.length > 0) {
    console.warn(`WARNING: Found ${missingResponses.length} tool calls without responses`);
    console.warn(`Missing response IDs: ${missingResponses.join(', ')}`);
  } else {
    console.log("Context structure validation passed: all tool calls have responses");
  }
}
