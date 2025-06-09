
/**
 * Service for handling MCP-based action detection
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

/**
 * Run MCP-based action detection workflow for a project
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param summary Project summary
 * @param trackName Track name
 * @param trackRoles Track roles
 * @param trackBasePrompt Track base prompt
 * @param nextStep Next step
 * @param projectData Project data
 * @param milestoneInstructions Milestone instructions
 * @param aiProvider AI provider
 * @param aiModel AI model
 * @param propertyAddress Property address for the project
 * @returns Result of the MCP action detection workflow
 */
export async function runActionDetectionWithMCP(
  supabase: any,
  projectId: string,
  summary: string,
  trackName: string,
  trackRoles: string,
  trackBasePrompt: string,
  nextStep: string,
  projectData: any,
  milestoneInstructions: string,
  aiProvider: string,
  aiModel: string,
  propertyAddress: string = ''
) {
  try {
    console.log('Running MCP-based action detection...');
    
    // Get the MCP orchestrator prompt
    const { data: mcpPrompt, error: mcpPromptError } = await supabase
      .from('workflow_prompts')
      .select('*')
      .eq('type', 'mcp_orchestrator')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (mcpPromptError || !mcpPrompt || !mcpPrompt.prompt_text) {
      console.error('No MCP orchestrator prompt found in the database:', mcpPromptError);
      return {
        error: 'No MCP orchestrator prompt available',
        status: 'error'
      };
    }
    
    // Format the context for the MCP orchestrator prompt
    const mcpContext = {
      summary: summary,
      track_name: trackName || 'Default Track',
      track_roles: trackRoles || '',
      track_base_prompt: trackBasePrompt || '',
      current_date: new Date().toISOString().split('T')[0],
      next_step: nextStep || '',
      new_data: JSON.stringify(projectData),
      is_reminder_check: false,
      milestone_instructions: milestoneInstructions || '',
      property_address: propertyAddress || '',
      available_tools: ['create_action_record', 'knowledge_base_lookup']
    };
    
    console.log('Calling MCP workflow with context:', Object.keys(mcpContext));
    
    // Create a service role client for internal function calls
    const serviceRoleClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Call the test-workflow-prompt function with service role permissions
    const { data: mcpResult, error: mcpError } = await serviceRoleClient.functions.invoke(
      'test-workflow-prompt',
      {
        body: {
          promptType: 'mcp_orchestrator',
          promptText: mcpPrompt.prompt_text,
          projectId: projectId,
          contextData: mcpContext,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: mcpPrompt.id,
          initiatedBy: 'zoho-webhook',
          useMCP: true,
          // Add a flag to indicate this is an internal service call
          internalServiceCall: true
        }
      }
    );
    
    if (mcpError) {
      console.error('Error invoking MCP workflow:', mcpError);
      return {
        error: `MCP workflow error: ${mcpError.message}`,
        status: 'error'
      };
    }
    
    console.log('MCP workflow completed successfully:', 
      mcpResult?.actionRecordId ? `Created action record: ${mcpResult.actionRecordId}` : 
      mcpResult?.toolOutputs ? `Generated ${mcpResult.toolOutputs.length} tool outputs` : 
      'No action needed');
    
    return mcpResult;
  } catch (error) {
    console.error('Error in MCP action detection process:', error);
    return {
      error: `MCP action detection failed: ${error.message}`,
      status: 'error'
    };
  }
}
