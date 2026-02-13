import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { AI_CONFIG } from '../_shared/aiConfig.ts';

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
    
    // Create a service role client for internal function calls
    const serviceRoleClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Process each project that's due for a check
    // NOTE: get_projects_due_for_check() already filters by activation criteria:
    // - Contract_Signed IS NOT NULL
    // - Roof_Install_Finalized IS NULL
    // - Test_Record = false
    // - Project_status/crm_status NOT IN ('Archived', 'VOID', 'Cancelled', 'Canceled')
    // So we can skip the CRM fetch and activation criteria check entirely!
    
    for (const project of projectsDue || []) {
      console.log(`Processing project ${project.id} with next_check_date: ${project.next_check_date}`);
      console.log(`Project ${project.id} passed DB-level activation criteria filter, proceeding...`);
      
      try {
        // Get the Tool Orchestrator prompt
        const { data: prompt, error: promptError } = await supabase
          .from('workflow_prompts')
          .select('*')
          .eq('type', 'tool_orchestrator')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (promptError) {
          console.error(`Error fetching Tool Orchestrator prompt for project ${project.id}:`, promptError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch Tool Orchestrator prompt"
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
        
        // Prepare context for the Tool Orchestrator
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
        
        // Use centralized AI configuration
        const aiProvider = AI_CONFIG.provider;
        const aiModel = AI_CONFIG.model;
        
        console.log(`Using MCP workflow for project ${project.id} with ${aiProvider} ${aiModel}`);
        console.log(`Invoking test-workflow-prompt with internal service call flag`);
        
        // Call the MCP workflow using service role client with internal service call flag
        const { data: mcpResult, error: mcpError } = await serviceRoleClient.functions.invoke(
          'test-workflow-prompt',
          {
            body: {
              promptType: 'tool_orchestrator',
              promptText: prompt.prompt_text,
              projectId: project.id,
              contextData: context,
              aiProvider: aiProvider,
              aiModel: aiModel,
              workflowPromptId: prompt.id,
              initiatedBy: 'check-project-reminders',
              useMCP: true,
              // Add flag to indicate this is an internal service call
              internalServiceCall: true
            }
          }
        );
        
        if (mcpError) {
          console.error(`Error invoking MCP workflow for project ${project.id}:`, mcpError);
          console.error(`Error details:`, JSON.stringify(mcpError, null, 2));
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
        console.error(`Error stack:`, error.stack);
        results.push({
          project_id: project.id,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    const successfulProcesses = results.filter(r => r.success).length;
    const failedProcesses = results.filter(r => !r.success).length;
    const skippedProcesses = results.filter(r => r.success && r.skipped).length;
    
    console.log(`Completed check-project-reminders: ${successfulProcesses} successful (${skippedProcesses} skipped), ${failedProcesses} failed`);
    
    return new Response(
      JSON.stringify({
        projects_processed: projectsDue?.length || 0,
        successful_processes: successfulProcesses,
        failed_processes: failedProcesses,
        skipped_processes: skippedProcesses,
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
    console.error("Error stack:", error.stack);
    
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
