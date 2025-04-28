
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

interface TestRunParams {
  selectedPromptIds: string[];
  selectedProjectIds: string[];
  isMultiProjectTest: boolean;
  userEmail: string;
  useMCP: boolean;
}

export interface TestRunResult {
  projectId: string;
  results: Array<{
    type: string;
    output: any;
    finalPrompt: string;
    promptRunId: string;
    actionRecordId?: string;
    reminderSet: boolean;
    nextCheckDateInfo?: any;
    usedMCP: boolean;
    humanReviewRequestId?: string;
    knowledgeResultsCount?: number;
  }>;
}

export const runTests = async ({
  selectedPromptIds,
  selectedProjectIds,
  isMultiProjectTest,
  userEmail,
  useMCP
}: TestRunParams): Promise<TestRunResult[]> => {
  if (selectedPromptIds.length === 0 || selectedProjectIds.length === 0) {
    throw new Error("Please select at least one prompt and one project to test.");
  }
  
  // Get AI configuration
  const { data: aiConfig, error: aiConfigError } = await supabase
    .from('ai_config')
    .select('provider, model')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  const aiProvider = aiConfig?.provider || 'openai';
  const aiModel = aiConfig?.model || 'gpt-4o';
  
  const allResults: TestRunResult[] = [];
  
  for (const projectId of selectedProjectIds) {
    // Fetch the project details
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        crm_id,
        summary,
        next_step,
        company_id,
        project_track,
        Address,
        companies(name),
        project_tracks(name, "track base prompt", Roles)
      `)
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      console.error("Error fetching project:", projectError);
      throw projectError;
    }
    
    if (!projectData) {
      console.error("No project data found for ID:", projectId);
      throw new Error("Project not found");
    }
    
    // Prepare context data
    const contextData = {
      summary: projectData.summary || '',
      next_step: projectData.next_step || '',
      company_name: projectData.companies?.name || 'Unknown Company',
      track_name: projectData.project_tracks?.name || 'Default Track',
      track_base_prompt: projectData.project_tracks?.["track base prompt"] || '',
      track_roles: projectData.project_tracks?.Roles || '',
      current_date: new Date().toISOString().split('T')[0],
      milestone_instructions: '',
      action_description: 'Sample action for testing',
      isMultiProjectTest: isMultiProjectTest,
      property_address: projectData.Address || ''  // Use the Address field
    };
    
    // Get milestone instructions if this is a next step
    if (projectData.next_step) {
      const { data: milestoneData } = await supabase
        .from('project_track_milestones')
        .select('prompt_instructions')
        .eq('track_id', projectData.project_track)
        .eq('step_title', projectData.next_step)
        .maybeSingle();
        
      if (milestoneData) {
        contextData.milestone_instructions = milestoneData.prompt_instructions || '';
      }
    }
    
    const projectResults = [];
    
    for (const promptId of selectedPromptIds) {
      // Fetch the prompt details
      const { data: promptData, error: promptError } = await supabase
        .from('workflow_prompts')
        .select('*')
        .eq('id', promptId)
        .single();
      
      if (promptError) throw promptError;
      
      // Call the edge function to test the prompt
      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          promptType: promptData.type,
          promptText: promptData.prompt_text,
          projectId: projectData.id,
          contextData: contextData,
          aiProvider: aiProvider,
          aiModel: aiModel,
          workflowPromptId: promptData.id,
          initiatedBy: userEmail,
          isMultiProjectTest: isMultiProjectTest,
          useMCP: useMCP // Use Model Context Protocol if enabled
        }
      });
      
      if (error) throw error;
      
      projectResults.push({
        type: promptData.type,
        output: data.output,
        finalPrompt: data.finalPrompt,
        promptRunId: data.promptRunId,
        actionRecordId: data.actionRecordId,
        reminderSet: data.reminderSet || false,
        nextCheckDateInfo: data.nextCheckDateInfo,
        usedMCP: data.usedMCP,
        humanReviewRequestId: data.humanReviewRequestId,
        knowledgeResultsCount: data.knowledgeResults
      });
    }
    
    allResults.push({
      projectId: projectId,
      results: projectResults
    });
  }
  
  return allResults;
};
