import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

type WorkflowType = 'summary_generation' | 'summary_update' | 'action_detection' | 'action_execution';

type WorkflowPrompt = {
  id: number;
  type: WorkflowType;
  prompt_text: string;
};

type Project = {
  id: number;
  summary: string | null;
  project_track: number | null;
  track_name?: string | null;
};

type TestResult = {
  projectId: number;
  results: {
    type: WorkflowType;
    output: string;
  }[];
};

const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: "Summary Generation",
  summary_update: "Summary Update",
  action_detection: "Action Detection",
  action_execution: "Action Execution"
};

const AdminConsole = () => {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<WorkflowPrompt | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestingPrompts, setIsTestingPrompts] = useState(false);

  const { data: prompts, isLoading: isLoadingPrompts, error: promptsError } = useQuery({
    queryKey: ['workflow-prompts'],
    queryFn: async () => {
      console.log('Fetching workflow prompts...');
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('*')
        .order('type');
      
      if (error) {
        console.error('Error fetching prompts:', error);
        throw error;
      }
      console.log('Fetched prompts:', data);
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

  const updatePromptMutation = useMutation({
    mutationFn: async (prompt: WorkflowPrompt) => {
      const { error } = await supabase
        .from('workflow_prompts')
        .update({ prompt_text: prompt.prompt_text })
        .eq('id', prompt.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-prompts'] });
      toast({
        title: "Prompt Updated",
        description: "The workflow prompt has been successfully updated.",
      });
      setEditingPrompt(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update prompt: ${error.message}`,
      });
    }
  });

  const testPromptSequence = async () => {
    setIsTestingPrompts(true);
    setTestResults([]);
    
    try {
      for (const projectId of selectedProjects) {
        const results: TestResult['results'] = [];
        
        for (const prompt of prompts || []) {
          console.log(`Testing prompt type: ${prompt.type}`);
          
          const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
            body: {
              projectId,
              promptType: prompt.type,
              promptText: prompt.prompt_text,
              previousResults: results
            },
          });

          if (error) {
            throw error;
          }

          results.push({
            type: prompt.type,
            output: data.result
          });
          
          console.log(`Results for ${prompt.type}:`, data.result);
        }

        setTestResults(prev => [...prev, { projectId, results }]);
      }

      toast({
        title: "Test Complete",
        description: "All prompts have been tested successfully.",
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

  if (promptsError) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/15 text-destructive p-4 rounded-md">
          <h2 className="font-semibold mb-2">Error Loading Admin Console</h2>
          <p>{promptsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Workflow Prompts Admin</h1>
        <p className="text-muted-foreground">Manage and test AI workflow prompts</p>
      </header>

      <Tabs defaultValue="prompts">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="testing">Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-6">
          {isLoadingPrompts ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !prompts?.length ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">
                  No workflow prompts found. Please make sure the workflow_prompts table exists and contains data.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {prompts.map((prompt) => (
                <Card key={prompt.id}>
                  <CardHeader>
                    <CardTitle>{workflowTitles[prompt.type]}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editingPrompt?.id === prompt.id ? (
                      <div className="space-y-4">
                        <Textarea
                          value={editingPrompt.prompt_text}
                          onChange={(e) => setEditingPrompt({
                            ...editingPrompt,
                            prompt_text: e.target.value
                          })}
                          rows={5}
                        />
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => updatePromptMutation.mutate(editingPrompt)}
                            disabled={updatePromptMutation.isPending}
                          >
                            {updatePromptMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setEditingPrompt(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md">
                          {prompt.prompt_text}
                        </pre>
                        <Button 
                          variant="outline"
                          onClick={() => setEditingPrompt(prompt)}
                        >
                          Edit Prompt
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Workflow Prompts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Select</TableHead>
                        <TableHead>Project ID</TableHead>
                        <TableHead>Current Summary</TableHead>
                        <TableHead>Project Track</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingProjects ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : !projects?.length ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center">
                            No projects found
                          </TableCell>
                        </TableRow>
                      ) : (
                        projects.map((project) => (
                          <TableRow key={project.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedProjects.includes(project.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedProjects(prev => 
                                    checked 
                                      ? [...prev, project.id]
                                      : prev.filter(id => id !== project.id)
                                  );
                                }}
                              />
                            </TableCell>
                            <TableCell>{project.id}</TableCell>
                            <TableCell className="max-w-md truncate">
                              {project.summary || 'No summary'}
                            </TableCell>
                            <TableCell>
                              {project.track_name || 'No track assigned'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={testPromptSequence}
                    disabled={isTestingPrompts || selectedProjects.length === 0}
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

                {testResults.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Test Results</h3>
                    {testResults.map((result) => (
                      <Card key={result.projectId}>
                        <CardHeader>
                          <CardTitle>Project {result.projectId}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {result.results.map((promptResult, index) => {
                              const currentPrompt = prompts?.find(p => p.type === promptResult.type);
                              return (
                                <div key={index} className="space-y-2">
                                  <h4 className="font-medium">
                                    {workflowTitles[promptResult.type]}
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <h5 className="text-sm font-medium text-muted-foreground mb-2">Prompt</h5>
                                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                                        {currentPrompt?.prompt_text || 'Prompt not found'}
                                      </pre>
                                    </div>
                                    <div>
                                      <h5 className="text-sm font-medium text-muted-foreground mb-2">Response</h5>
                                      <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                                        {promptResult.output}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminConsole;
