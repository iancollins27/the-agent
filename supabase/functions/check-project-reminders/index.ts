
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const currentTime = new Date().toISOString();
    console.log(`Running check-project-reminders function at ${currentTime}`);
    
    // Get projects that are due for checking
    const { data: projectsDue, error: projectsError } = await supabase.rpc(
      'get_projects_due_for_check'
    );
    
    if (projectsError) {
      console.error("Error fetching projects due for check:", projectsError);
      throw new Error("Failed to fetch projects due for check");
    }
    
    console.log(`Found ${projectsDue?.length || 0} projects due for check at ${currentTime}`);
    
    // If no projects are due, return early with success
    if (!projectsDue || projectsDue.length === 0) {
      return new Response(
        JSON.stringify({
          projects_processed: 0,
          results: [],
          message: "No projects due for check at this time",
          checked_at: currentTime
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
          status: 200,
        }
      );
    }
    
    // Track results for all project checks
    const results = [];
    
    // Process each project that's due for a check
    for (const project of projectsDue || []) {
      console.log(`Processing project ${project.id} with next_check_date: ${project.next_check_date}`);
      
      try {
        // Get the MCP orchestrator prompt instead of action detection
        const { data: prompt, error: promptError } = await supabase
          .from('workflow_prompts')
          .select('*')
          .eq('type', 'mcp_orchestrator')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (promptError) {
          console.error(`Error fetching MCP orchestrator prompt for project ${project.id}:`, promptError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch MCP orchestrator prompt"
          });
          continue;
        }
        
        // Get company name and project track info for context
        const { data: contextData, error: contextError } = await supabase
          .from('projects')
          .select(`
            id,
            summary,
            next_step,
            companies(name),
            project_track,
            project_tracks(name)
          `)
          .eq('id', project.id)
          .single();
          
        if (contextError) {
          console.error(`Error fetching context data for project ${project.id}:`, contextError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch project context data"
          });
          continue;
        }
        
        // Prepare context for the MCP orchestrator
        const context = {
          project_id: project.id,
          summary: contextData.summary,
          next_step: contextData.next_step,
          company_name: contextData.companies?.name,
          track_name: contextData.project_tracks?.name,
          current_date: new Date().toISOString().split('T')[0],
          is_reminder_check: true,
          scheduled_check_time: currentTime,
          original_next_check_date: project.next_check_date,
          available_tools: ['create_action_record', 'knowledge_base_lookup']
        };
        
        // Get AI configuration
        const { data: aiConfig, error: aiConfigError } = await supabase
          .from('ai_config')
          .select('provider, model')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (aiConfigError) {
          console.error(`Error fetching AI config for project ${project.id}:`, aiConfigError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch AI configuration"
          });
          continue;
        }
        
        const aiProvider = aiConfig?.provider || 'openai';
        const aiModel = aiConfig?.model || 'gpt-4o';
        
        console.log(`Using MCP workflow for project ${project.id} with ${aiProvider} ${aiModel}`);
        
        // Call the MCP workflow instead of the old action detection
        const { data: mcpResult, error: mcpError } = await supabase.functions.invoke(
          'test-workflow-prompt',
          {
            body: {
              promptType: 'mcp_orchestrator',
              promptText: prompt.prompt_text,
              projectId: project.id,
              contextData: context,
              aiProvider: aiProvider,
              aiModel: aiModel,
              workflowPromptId: prompt.id,
              initiatedBy: 'check-project-reminders',
              useMCP: true
            }
          }
        );
        
        if (mcpError) {
          console.error(`Error invoking MCP workflow for project ${project.id}:`, mcpError);
          results.push({
            project_id: project.id,
            success: false,
            error: `Error invoking MCP workflow: ${mcpError.message}`
          });
          continue;
        }
        
        console.log(`MCP workflow completed for project ${project.id}:`, 
          mcpResult?.actionRecordId ? `Created action record: ${mcpResult.actionRecordId}` : 
          mcpResult?.toolOutputs ? `Generated ${mcpResult.toolOutputs.length} tool outputs` : 
          'No action needed');
        
        // Update the project's last action check regardless of outcome
        await supabase
          .from('projects')
          .update({
            last_action_check: new Date().toISOString()
          })
          .eq('id', project.id);
        
        results.push({
          project_id: project.id,
          success: true,
          action_type: mcpResult?.actionType || 'mcp_processed',
          processed_at: currentTime,
          tool_outputs: mcpResult?.toolOutputs?.length || 0
        });
        
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        results.push({
          project_id: project.id,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    const successfulProcesses = results.filter(r => r.success).length;
    const failedProcesses = results.filter(r => !r.success).length;
    
    console.log(`Completed check-project-reminders: ${successfulProcesses} successful, ${failedProcesses} failed`);
    
    return new Response(
      JSON.stringify({
        projects_processed: projectsDue?.length || 0,
        successful_processes: successfulProcesses,
        failed_processes: failedProcesses,
        checked_at: currentTime,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in check-project-reminders function:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        checked_at: new Date().toISOString()
      }),
      {
        headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 500,
    }
  );
}
});
