
/**
 * Functions for processing tool calls in MCP
 */
import { extractToolCallsFromOpenAI } from '../mcp.ts';
import { executeToolCall } from '../tools/toolExecutor.ts';

export async function processToolCalls(
  supabase: any,
  message: any,
  context: any,
  userProfile: any,
  companyId: string | null,
  processedToolCallIds: Set<string>
): Promise<{
  projectData: any | null,
  processedIds: Set<string>
}> {
  let projectData = null;
  
  // Extract tool calls from the message
  const extractedToolCalls = extractToolCallsFromOpenAI(message);
  
  // Remove the assistant message that was just added since we'll re-add it properly
  context.messages.pop();
  
  // Process each tool call in order
  for (const call of extractedToolCalls) {
    // Skip if we've already processed this tool call ID
    if (processedToolCallIds.has(call.id)) {
      console.log(`Skipping already processed tool call ID: ${call.id}`);
      continue;
    }
    
    console.log(`Processing tool call: ${call.name}, id: ${call.id}`);
    processedToolCallIds.add(call.id); // Mark as processed
  
    try {
      // Execute the tool
      const toolResult = await executeToolCall(
        supabase,
        call.name,
        call.arguments,
        userProfile,
        companyId
      );
      
      // Extract project data if this is an identify_project call
      if (call.name === 'identify_project' && 
          toolResult?.status === 'success' && 
          toolResult?.projects?.length > 0) {
        projectData = toolResult.projects[0];
        console.log('Found project data:', projectData);
      }
      
      // Add tool message to context
      context.messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments)
            }
          }
        ]
      });
      
      // Add the tool result
      context.messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(toolResult)
      });
      
      // If this is a successful project identification, add a system message to prevent repeated lookups
      if (call.name === 'identify_project' && 
          toolResult?.status === 'success' && 
          toolResult?.projects?.length > 0) {
        context.addSystemMessage(`Project ${projectData.id} information is now in your context. You do not need to identify it again for follow-up questions. Focus on answering the user's questions directly using this context.`);
      }
    } 
    catch (toolError) {
      console.error(`Error executing tool ${call.name}: ${toolError}`);
      
      // Add error result
      const errorResult = { 
        status: "error", 
        error: toolError.message || "Unknown tool execution error",
        message: `Tool execution failed: ${toolError.message || "Unknown error"}`
      };
      
      // Add tool message to context
      context.messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments)
            }
          }
        ]
      });
      
      // Add the error result
      context.messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(errorResult)
      });
    }
  }

  return { projectData, processedIds: processedToolCallIds };
}
