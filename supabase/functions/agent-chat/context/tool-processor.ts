
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
  
  // Security validation - ensure company context is available
  if (!companyId || !userProfile) {
    console.error("Security error: Missing company context in tool processing");
    context.addSystemMessage("WARNING: Tool access is restricted due to missing company context");
    return { projectData: null, processedIds: processedToolCallIds };
  }
  
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
      // Execute the tool with context including companyId
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
        } else {
          // Just one project found, use it and include contacts data
          projectData = toolResult.projects[0];
          
          // Security check: Validate that the project belongs to the user's company
          if (projectData.company_id !== companyId) {
            console.error(`Security error: Project company (${projectData.company_id}) doesn't match user company (${companyId})`);
            context.addSystemMessage("WARNING: You don't have access to this project as it belongs to a different company.");
            projectData = null;
            
            // Override tool result
            toolResult.status = "error";
            toolResult.error = "Access denied: You don't have permission to access this project";
          } else {
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
        content: JSON.stringify(errorResult)
      });
    }
  }

  return { projectData, processedIds: processedToolCallIds };
}
