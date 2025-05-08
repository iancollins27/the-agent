/**
 * MCP Context Manager
 * Handles the management of conversation context for the Model Context Protocol
 */

import { getToolDefinitions } from './tools/toolRegistry.ts';
import { extractToolCallsFromOpenAI } from './mcp.ts';
import { executeToolCall } from './tools/toolExecutor.ts';

export interface MCPContextManager {
  messages: any[];
  tools: any[];
  processResponse: (response: any, supabase: any, userProfile: any, companyId: string | null) => Promise<{
    finalAnswer: string;
    actionRecordId: string | null;
    projectData: any;
    processedToolCallIds: Set<string>;
  }>;
  addSystemMessage: (content: string) => void;
}

export function createMCPContextManager(systemPrompt: string, userPrompt: string): MCPContextManager {
  // Create initial context with system and user messages
  const context = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    tools: getToolDefinitions(),
    
    // Add a method to process LLM responses
    processResponse: async function(
      response: any, 
      supabase: any, 
      userProfile: any, 
      companyId: string | null
    ) {
      const message = response.choices[0].message;
      let finalAnswer = '';
      let actionRecordId = null;
      let projectData = null;
      const processedToolCallIds = new Set<string>();
      
      // Add the assistant message to our context
      this.messages.push(message);
      
      // Check if the model wants to use tools
      const toolCalls = message.tool_calls;
      console.log(`Tool calls: ${toolCalls ? toolCalls.length : 0}`);

      if (toolCalls && toolCalls.length > 0) {
        // Process each tool call
        const extractedToolCalls = extractToolCallsFromOpenAI(message);
        
        // Remove the assistant message we just added since we'll re-add it properly 
        this.messages.pop();
        
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
            this.messages.push({
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
            this.messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(toolResult)
            });
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
            this.messages.push({
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
            this.messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify(errorResult)
            });
          }
        }
        
        // Return interim results - we'll need to call the LLM again
        return { finalAnswer, actionRecordId, projectData, processedToolCallIds };
      } else {
        // The model has provided a final answer (no tools)
        finalAnswer = message.content || "No response generated.";
        
        // Check if the response contains an action request
        if (finalAnswer && projectData?.id) {
          try {
            const jsonMatch = finalAnswer.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
              const actionData = JSON.parse(jsonMatch[1].trim());
              console.log('Extracted action data:', actionData);
              
              // Process actions (data_update, message, set_future_reminder)
              if (actionData.action_type === "data_update" && actionData.field_to_update && actionData.new_value) {
                const { data: actionRecord, error: actionError } = await supabase
                  .from('action_records')
                  .insert({
                    project_id: projectData.id,
                    action_type: 'data_update',
                    action_payload: {
                      field: actionData.field_to_update,
                      value: actionData.new_value,
                      description: actionData.description || `Update ${actionData.field_to_update} to ${actionData.new_value}`
                    },
                    requires_approval: true,
                    status: 'pending'
                  })
                  .select()
                  .single();
                
                if (actionError) {
                  console.error('Error creating action record:', actionError);
                } else {
                  actionRecordId = actionRecord.id;
                  console.log('Created data update action record:', actionRecord);
                  
                  // Remove the JSON block from the response
                  finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                }
              } 
              else if (actionData.action_type === "message" && actionData.recipient && actionData.message_content) {
                let recipientId = null;
                let senderId = null;
                const recipientName = actionData.recipient.trim();
                const senderName = actionData.sender || "System";
                
                if (recipientName.length > 3 && !["team", "customer", "client", "user"].includes(recipientName.toLowerCase())) {
                  const { data: contacts } = await supabase
                    .from('contacts')
                    .select('id, full_name')
                    .ilike('full_name', `%${recipientName}%`);
                    
                  if (contacts && contacts.length > 0) {
                    recipientId = contacts[0].id;
                    console.log(`Found contact match for "${recipientName}": ${contacts[0].full_name} (${recipientId})`);
                  }
                }
                
                if (senderName && senderName.length > 3 && senderName !== "System") {
                  const { data: senders } = await supabase
                    .from('contacts')
                    .select('id, full_name')
                    .ilike('full_name', `%${senderName}%`);
                    
                  if (senders && senders.length > 0) {
                    senderId = senders[0].id;
                    console.log(`Found sender match for "${senderName}": ${senders[0].full_name} (${senderId})`);
                  }
                }
                
                const { data: actionRecord, error: actionError } = await supabase
                  .from('action_records')
                  .insert({
                    project_id: projectData.id,
                    action_type: 'message',
                    action_payload: {
                      recipient: actionData.recipient,
                      sender: senderName,
                      message_content: actionData.message_content,
                      description: actionData.description || `Send message to ${actionData.recipient}`
                    },
                    message: actionData.message_content,
                    recipient_id: recipientId,
                    sender_ID: senderId,
                    requires_approval: true,
                    status: 'pending'
                  })
                  .select()
                  .single();
                
                if (actionError) {
                  console.error('Error creating message action record:', actionError);
                } else {
                  actionRecordId = actionRecord.id;
                  console.log('Created message action record:', actionRecord);
                  
                  finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                }
              } else if (actionData.action_type === "set_future_reminder" && actionData.days_until_check) {
                const { data: actionRecord, error: actionError } = await supabase
                  .from('action_records')
                  .insert({
                    project_id: projectData.id,
                    action_type: 'set_future_reminder',
                    action_payload: {
                      days_until_check: actionData.days_until_check,
                      check_reason: actionData.check_reason || 'Follow-up check',
                      description: actionData.description || `Check project in ${actionData.days_until_check} days`
                    },
                    requires_approval: true,
                    status: 'pending'
                  })
                  .select()
                  .single();
                
                if (actionError) {
                  console.error('Error creating reminder action record:', actionError);
                } else {
                  actionRecordId = actionRecord.id;
                  console.log('Created reminder action record:', actionRecord);
                  
                  finalAnswer = finalAnswer.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
                }
              }
            }
          } catch (parseError) {
            console.error('Error parsing action data:', parseError);
          }
        }
        
        return { finalAnswer, actionRecordId, projectData, processedToolCallIds };
      }
    },
    
    // Add a method to insert system messages
    addSystemMessage: function(content: string) {
      this.messages.push({ role: 'system', content });
    }
  };
  
  return context;
}
