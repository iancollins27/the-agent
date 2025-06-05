
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
        
        // The external edge function will handle company_id and user_id internally
        // No need to explicitly add them to arguments since toolExecutor handles this
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
      
      // Extract project data if this is an identify_project call
      if (call.name === 'identify_project' && 
          toolResult?.status === 'success' && 
          toolResult?.projects?.length > 0) {
        
        // Check for multiple matches
        if (toolResult.projects.length > 1) {
          // Always treat multiple matches as requiring clarification,
          // regardless of similarity scores
          const projectOptions = toolResult.projects.map((p: any, index: number) => {
            const details = [
              `#${index + 1}:`,
              p.address ? `Address: ${p.address}` : null,
              p.project_name ? `Name: ${p.project_name}` : null,
              p.crm_id ? `CRM ID: ${p.crm_id}` : null,
              p.status ? `Status: ${p.status}` : null
            ].filter(Boolean).join(' ');
            
            return details;
          }).join('\n');
          
          // Let's customize the tool result to indicate multiple matches were found
          toolResult.multipleMatches = true;
          toolResult.message = `Found ${toolResult.projects.length} projects matching your query. Please specify which one you're referring to:\n\n${projectOptions}`;
          
          // Don't set projectData yet, as we need user clarification
          console.log('Multiple project matches found, awaiting user clarification');
        } else if (toolResult.projects.length === 1) {
          // Just one project found, use it and include contacts data
          projectData = toolResult.projects[0];
          
          // Include any company ID that was found
          if (toolResult.company_id) {
            projectData.company_id = toolResult.company_id;
          }
          
          // Include explicit project ID if available
          if (toolResult.project_id) {
            projectData.id = toolResult.project_id;
          }
          
          // Include contacts data if available
          if (toolResult.contacts && toolResult.contacts.length > 0) {
            projectData.contacts = toolResult.contacts;
            console.log(`Found ${toolResult.contacts.length} contacts for the project`);
          }
          
          console.log('Found project data:', projectData);
        }
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
      
      // If this is a successful project identification with a single project match,
      // add a system message to prevent repeated lookups
      if (call.name === 'identify_project' && 
          toolResult?.status === 'success' && 
          !toolResult?.multipleMatches &&
          projectData) {
        // Add system message with project information and contacts
        let contactsInfo = '';
        if (projectData.contacts && projectData.contacts.length > 0) {
          contactsInfo = `\n\nProject Contacts:\n` + projectData.contacts.map((contact: any) => {
            return `- ${contact.full_name} (${contact.role}): ID:${contact.id}, ${contact.email || ''} ${contact.phone_number || ''}`
          }).join('\n');
        }
        
        context.addSystemMessage(`Project ${projectData.id} information is now in your context. You do not need to identify it again for follow-up questions.${contactsInfo}`);
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
        content: JSON.stringify(toolResult)
      });
    }
  }
  
  return { projectData, processedIds: processedToolCallIds };
}
