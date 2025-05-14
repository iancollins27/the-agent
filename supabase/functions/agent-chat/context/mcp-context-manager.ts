
/**
 * MCP Context Manager
 * Handles the management of conversation context for the Model Context Protocol
 */

import { getToolDefinitions, filterTools } from '../tools/toolRegistry.ts';
import { MCPContextManager } from './types.ts';
import { processToolCalls } from './tool-processor.ts';
import { processActionData } from './action-processor.ts';

export function createMCPContextManager(
  systemPrompt: string, 
  userPrompt: string, 
  enabledTools: string[] = []
): MCPContextManager {
  // Get tool definitions based on configuration
  const tools = enabledTools.length > 0 
    ? filterTools(enabledTools) 
    : getToolDefinitions();
  
  // Create initial context with system and user messages
  const context = {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    tools: tools,
    
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
      
      // Security validation: Ensure company context exists
      if (!companyId || !userProfile) {
        console.error("Security error: Missing company context in MCP processing");
        // Add security warning to the context
        this.addSystemMessage("WARNING: User company context could not be verified. Tool access restricted.");
        
        return { 
          finalAnswer: "I'm sorry, but I cannot access company data without proper authentication. Please ensure you're logged in correctly.", 
          actionRecordId: null, 
          projectData: null,
          processedToolCallIds
        };
      }
      
      // Check if the model wants to use tools
      const toolCalls = message.tool_calls;
      console.log(`Tool calls: ${toolCalls ? toolCalls.length : 0}`);

      if (toolCalls && toolCalls.length > 0) {
        // Process tool calls and get any project data that was identified
        const toolResult = await processToolCalls(
          supabase,
          message,
          this,
          userProfile,
          companyId,
          processedToolCallIds
        );
        
        projectData = toolResult.projectData;
        
        // Additional company validation for project data
        if (projectData && projectData.company_id && projectData.company_id !== companyId) {
          console.error("Security error: Project belongs to a different company than the user");
          this.addSystemMessage("WARNING: You attempted to access a project from a different company. Access denied.");
          projectData = null;
        }
        
        // Update the set of processed tool call IDs with any new ones
        toolResult.processedIds.forEach(id => processedToolCallIds.add(id));
        
        // Return interim results - we'll need to call the LLM again
        return { finalAnswer, actionRecordId, projectData, processedToolCallIds };
      } else {
        // The model has provided a final answer (no tools)
        finalAnswer = message.content || "No response generated.";
        
        // Process any action requests in the final answer
        if (finalAnswer && projectData?.id) {
          // Validate project company before processing actions
          const { data } = await supabase
            .from('projects')
            .select('company_id')
            .eq('id', projectData.id)
            .single();
            
          if (!data || data.company_id !== companyId) {
            console.error("Security error: Attempted action on project from different company");
            return { 
              finalAnswer: "I cannot perform actions on this project due to company access restrictions.", 
              actionRecordId: null, 
              projectData: null,
              processedToolCallIds 
            };
          }
          
          const actionResult = await processActionData(supabase, finalAnswer, projectData);
          finalAnswer = actionResult.finalAnswer;
          actionRecordId = actionResult.actionRecordId;
        }
        
        return { finalAnswer, actionRecordId, projectData, processedToolCallIds };
      }
    },
    
    // Add a method to insert system messages
    addSystemMessage: function(content: string) {
      console.log('Adding system message:', content);
      this.messages.push({ role: 'system', content });
    }
  };
  
  return context;
}
