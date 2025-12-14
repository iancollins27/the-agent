
/**
 * Functions for processing tool calls in MCP
 */
import { extractToolCallsFromOpenAI } from '../mcp.ts';
import { executeToolCall } from '../tools/toolExecutor.ts';

// Similarity threshold - projects above this are considered good matches
const SIMILARITY_THRESHOLD = 0.7;

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
  
  // Enhanced logging for security context
  console.log(`Processing ${extractedToolCalls.length} tool calls with security context - user: ${userProfile?.id || 'anonymous'}, company: ${companyId || 'none'}`);

  // Process each tool call in order
  for (const call of extractedToolCalls) {
    // Skip if we've already processed this tool call ID
    if (processedToolCallIds.has(call.id)) {
      console.log(`Skipping already processed tool call ID: ${call.id}`);
      continue;
    }
    
    // Add enhanced security logging
    console.log(`Processing tool call: ${call.name}, id: ${call.id}, with company ID: ${companyId || 'none'}, user: ${userProfile?.id || 'anonymous'}`);
    processedToolCallIds.add(call.id); // Mark as processed
  
    try {
      // GUARD: Skip identify_project if we already have projectId in context
      if (call.name === 'identify_project' && context.projectId) {
        console.log(`Skipping identify_project - project already identified: ${context.projectId}`);
        
        // Return the existing project data
        const knownProjectResult = {
          status: "success",
          projects: context.projectData ? [context.projectData] : [],
          project_id: context.projectId,
          message: "Project already identified"
        };
        
        // Add tool message to context
        context.messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments)
            }
          }]
        });
        
        // Add the result
        context.messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(knownProjectResult)
        });
        
        continue; // Skip to next tool call
      }
      
      // Log detailed information about the arguments
      if (call.name === 'identify_project') {
        console.log(`identify_project query: "${call.arguments.query}", type: ${call.arguments.type || 'any'}, enforcing company filter: ${companyId || 'none'}`);
        
        // STRICT SECURITY: Require company ID for identify_project
        if (!companyId) {
          console.error(`Security violation: identify_project called without company ID`);
          const errorResult = {
            status: "error",
            error: "Missing company ID",
            message: "For security reasons, company ID is required for project identification"
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
          
          continue; // Skip to next tool call
        }
      }
      
      // Execute the tool with context including companyId
      const toolResult = await executeToolCall(
        supabase,
        call.name,
        call.arguments,
        userProfile,
        companyId
      );
      
      console.log(`Tool ${call.name} completed with status: ${toolResult.status || 'unknown'}`);
      
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
    } 
    catch (toolError) {
      console.error(`Error executing tool ${call.name}: ${toolError}`);
      
      // Add error result
      const errorMessage = toolError instanceof Error ? toolError.message : "Unknown tool execution error";
      const errorResult = { 
        status: "error", 
        error: errorMessage,
        message: `Tool execution failed: ${errorMessage}`
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
