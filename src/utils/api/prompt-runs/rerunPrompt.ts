
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RerunPromptResult } from './types';

/**
 * Re-runs a specific prompt run with the same configuration but using the latest AI model and prompt template
 * 
 * @param promptRunId - The ID of the prompt run to re-execute
 * @returns An object with the new promptRunId if successful or an error message
 */
export const rerunPrompt = async (promptRunId: string): Promise<RerunPromptResult> => {
  try {
    // Step 1: Fetch the original prompt run details
    const { data: originalRun, error: fetchError } = await supabase
      .from('prompt_runs')
      .select(`
        id,
        prompt_input,
        project_id,
        workflow_prompt_id,
        workflow_prompts:workflow_prompt_id (type)
      `)
      .eq('id', promptRunId)
      .single();

    if (fetchError || !originalRun) {
      console.error("Error fetching original prompt run:", fetchError);
      return { 
        success: false, 
        error: `Could not find the original prompt run: ${fetchError?.message || "Not found"}` 
      };
    }

    // Step 2: Get the latest prompt template for the same type
    const { data: latestPrompt, error: promptError } = await supabase
      .from('workflow_prompts')
      .select('id, prompt_text')
      .eq('type', originalRun.workflow_prompts?.type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (promptError || !latestPrompt) {
      console.error("Could not fetch the latest prompt template:", promptError);
      return {
        success: false,
        error: `Could not fetch the latest prompt template: ${promptError?.message || "Not found"}`
      };
    }

    // Step 3: Get the latest AI configuration from company settings
    const { data: aiConfig, error: configError } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (configError) {
      console.warn("Could not fetch AI configuration, using default values:", configError);
    }

    // Step 4: Call the test-workflow-prompt edge function with the original parameters
    const promptType = originalRun.workflow_prompts?.type || 'unknown';
    
    // Fetch project details to get the most current data
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id, 
        summary, 
        next_step, 
        project_track,
        project_tracks:project_track (name, "track base prompt", Roles),
        companies (name),
        Address
      `)
      .eq('id', originalRun.project_id)
      .single();

    if (projectError) {
      console.warn("Could not fetch project details:", projectError);
      return {
        success: false,
        error: `Could not fetch project details: ${projectError.message}`
      };
    }

    if (!projectData) {
      return {
        success: false,
        error: "Project not found"
      };
    }

    // Create context data for the prompt
    const contextData = {
      summary: projectData.summary || '',
      next_step: projectData.next_step || '',
      company_name: projectData.companies?.name || 'Unknown Company',
      track_name: projectData.project_tracks?.name || 'Default Track',
      track_base_prompt: projectData.project_tracks?.["track base prompt"] || '',
      track_roles: projectData.project_tracks?.Roles || '',
      current_date: new Date().toISOString().split('T')[0],
      milestone_instructions: '',
      action_description: 'Re-run from dashboard',
      property_address: projectData.Address || ''  // Use the Address field
    };

    // Use the full URL with the project ID from the environment
    const response = await fetch(`https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/test-workflow-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aWZzeHNyYmx1ZWhvcGFtcXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4MzA0NjIsImV4cCI6MjA1NTQwNjQ2Mn0.3MYZOhz5kH71qxniwzHDzVzF3PKCulkvACDc8R1pI6I`
      },
      body: JSON.stringify({
        promptType: promptType,
        promptText: latestPrompt.prompt_text,  // Using the latest prompt text from the template
        projectId: originalRun.project_id,
        workflowPromptId: latestPrompt.id,     // Using the latest prompt ID
        contextData: contextData,              // Passing the context data
        aiProvider: aiConfig?.provider || 'openai',
        aiModel: aiConfig?.model || 'gpt-4o',
        useMCP: false,
        initiatedBy: 're-run button',
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error calling test-workflow-prompt: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.promptRunId) {
      return { 
        success: false, 
        error: "Re-run completed but no new prompt run ID was returned" 
      };
    }

    return {
      success: true,
      newPromptRunId: result.promptRunId
    };

  } catch (error) {
    console.error("Error re-running prompt:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
};
