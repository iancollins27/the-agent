
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TestResult, WorkflowPrompt, WorkflowType, Project } from "@/types/workflow";
import ProjectSelector from "./ProjectSelector";
import PromptSelector from "./PromptSelector";
import TestResults from "./TestResults";

const TestingTab = () => {
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestingPrompts, setIsTestingPrompts] = useState(false);

  const { data: prompts, isLoading: isLoadingPrompts } = useQuery({
    queryKey: ['workflow-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('*')
        .order('type');
      
      if (error) throw error;
      return data as WorkflowPrompt[];
    }
  });

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects-with-tracks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          summary,
          project_track,
          project_tracks (
            name
          )
        `)
        .order('id');
      
      if (error) throw error;

      return data.map(project => ({
        ...project,
        track_name: project.project_tracks?.name
      })) as Project[];
    }
  });

  const handlePromptSelection = (promptId: string, checked: boolean) => {
    setSelectedPrompts(prev =>
      checked
        ? [...prev, promptId]
        : prev.filter(id => id !== promptId)
    );
  };

  const handleProjectSelection = (projectId: string, checked: boolean) => {
    setSelectedProjects(prev =>
      checked
        ? [...prev, projectId]
        : prev.filter(id => id !== projectId)
    );
  };

  const testPromptSequence = async () => {
    if (!selectedPrompts?.length) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one prompt to test.",
      });
      return;
    }

    setIsTestingPrompts(true);
    setTestResults([]);
    
    try {
      for (const projectId of selectedProjects) {
        const results: TestResult['results'] = [];
        const selectedPromptData = prompts?.filter(p => selectedPrompts.includes(p.id)) || [];
        const project = projects?.find(p => p.id === projectId);
        
        // Prepare the project data for variable replacement
        if (!project) {
          console.error(`Project with ID ${projectId} not found`);
          continue;
        }

        for (const prompt of selectedPromptData) {
          console.log(`Testing prompt type: ${prompt.type}`);
          
          // Get all context data needed for testing
          const testContextData = {
            projectId,
            summary: project.summary || '',
            track_name: project.track_name || 'No Track',
            current_date: new Date().toLocaleDateString(),
            action_description: 'Sample action description for testing', // For action execution testing
            previousResults: results
          };
          
          console.log('Test context data:', testContextData);
          
          const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
            body: {
              projectId,
              promptType: prompt.type,
              promptText: prompt.prompt_text,
              contextData: testContextData,
              previousResults: results
            },
          });

          if (error) {
            console.error(`Error testing prompt ${prompt.type}:`, error);
            throw error;
          }

          results.push({
            type: prompt.type as WorkflowType,
            output: data.result,
            finalPrompt: data.finalPrompt
          });
          
          console.log(`Results for ${prompt.type}:`, data);
        }

        setTestResults(prev => [...prev, { projectId, results }]);
      }

      toast({
        title: "Test Complete",
        description: "Selected prompts have been tested successfully.",
      });
    } catch (error) {
      console.error('Error testing prompts:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to test prompts: ${error}`,
      });
    } finally {
      setIsTestingPrompts(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Workflow Prompts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Select Prompts to Test</h3>
            <PromptSelector
              prompts={prompts}
              selectedPrompts={selectedPrompts}
              onPromptSelectionChange={handlePromptSelection}
            />
          </div>

          <div className="border rounded-lg">
            <ProjectSelector
              projects={projects}
              isLoading={isLoadingProjects}
              selectedProjects={selectedProjects}
              onProjectSelectionChange={handleProjectSelection}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={testPromptSequence}
              disabled={isTestingPrompts || !selectedProjects?.length || !selectedPrompts?.length}
            >
              {isTestingPrompts ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Prompts...
                </>
              ) : (
                'Test Selected Projects'
              )}
            </Button>
          </div>

          <TestResults results={testResults} />
        </div>
      </CardContent>
    </Card>
  );
};

export default TestingTab;
