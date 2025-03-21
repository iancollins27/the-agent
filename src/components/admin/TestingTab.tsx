
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TestResults from "@/components/admin/TestResults";
import ProjectSelector from "@/components/admin/ProjectSelector";
import PromptSelector from "@/components/admin/PromptSelector";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const TestingTab = () => {
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<any>(null);
  const { toast } = useToast();
  
  const runTest = async () => {
    if (selectedPromptIds.length === 0 || selectedProjectIds.length === 0) {
      toast({
        variant: "destructive",
        title: "Selection Required",
        description: "Please select at least one prompt and one project to test."
      });
      return;
    }
    
    setIsLoading(true);
    setTestResults(null);
    
    try {
      // Get current user information
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email || 'unknown';
      
      // Get AI configuration
      const { data: aiConfig, error: aiConfigError } = await supabase
        .from('ai_config')
        .select('provider, model')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      const aiProvider = aiConfig?.provider || 'openai';
      const aiModel = aiConfig?.model || 'gpt-4o';
      
      const allResults = [];
      
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
            companies(name),
            project_tracks(name, description, Roles)
          `)
          .eq('id', projectId)
          .single();
        
        if (projectError) throw projectError;
        
        // Prepare context data
        const contextData = {
          summary: projectData.summary || '',
          next_step: projectData.next_step || '',
          company_name: projectData.companies?.name || 'Unknown Company',
          track_name: projectData.project_tracks?.name || 'Default Track',
          track_description: projectData.project_tracks?.description || '',
          track_roles: projectData.project_tracks?.Roles || '',
          current_date: new Date().toISOString().split('T')[0],
          milestone_instructions: '',
          action_description: 'Sample action for testing'
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
              initiatedBy: userEmail
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
            nextCheckDateInfo: data.nextCheckDateInfo
          });
        }
        
        allResults.push({
          projectId: projectId,
          results: projectResults
        });
      }
      
      setTestResults(allResults);
    } catch (error) {
      console.error('Error testing prompt:', error);
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: `Error: ${error.message || "Unknown error occurred"}`
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test Workflow Prompts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Prompt Selection */}
          <div>
            <h3 className="text-lg font-medium mb-2">Select Prompts</h3>
            <div className="border rounded-md p-4">
              <PromptSelector 
                selectedPromptIds={selectedPromptIds} 
                setSelectedPromptIds={setSelectedPromptIds} 
              />
            </div>
          </div>
          
          {/* Project Selection Table */}
          <div>
            <h3 className="text-lg font-medium mb-2">Select Projects</h3>
            <div className="border rounded-md">
              <ProjectSelector 
                selectedProjectIds={selectedProjectIds} 
                setSelectedProjectIds={setSelectedProjectIds} 
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button 
              onClick={runTest} 
              disabled={isLoading || selectedPromptIds.length === 0 || selectedProjectIds.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : "Run Test"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {testResults && (
        <TestResults results={testResults} />
      )}
    </div>
  );
};

export default TestingTab;
