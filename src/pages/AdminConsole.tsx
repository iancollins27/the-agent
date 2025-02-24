
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
  id: string;
  type: WorkflowType;
  prompt_text: string;
};

type Project = {
  id: string;
  summary: string | null;
  project_track: string | null;
  track_name?: string | null;
};

type TestResult = {
  projectId: string;
  results: {
    type: WorkflowType;
    output: string;
    finalPrompt: string;
  }[];
};

const workflowTitles: Record<WorkflowType, string> = {
  summary_generation: "Summary Generation",
  summary_update: "Summary Update",
  action_detection: "Action Detection",
  action_execution: "Action Execution"
};

const availableVariables = {
  summary_generation: [
    { name: "track_name", description: "The name of the project track" },
    { name: "current_date", description: "Today's date" }
  ],
  summary_update: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "current_date", description: "Today's date" }
  ],
  action_detection: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "current_date", description: "Today's date" }
  ],
  action_execution: [
    { name: "summary", description: "The current project summary" },
    { name: "track_name", description: "The name of the project track" },
    { name: "action_description", description: "The description of the action to be executed" },
    { name: "current_date", description: "Today's date" }
  ]
};

const AdminConsole = () => {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<WorkflowPrompt | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>(); // Changed from number[] to string[]
  const [selectedPrompts, setSelectedPrompts] = useState<string[]>(); // Changed from number[] to string[]
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
      for (const projectId of (selectedProjects || [])) {
        const results: TestResult['results'] = [];
        const selectedPromptData = prompts?.filter(p => selectedPrompts.includes(p.id)) || [];
        
        for (const prompt of selectedPromptData) {
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
                    <div className="space-y-6">
                      {/* Variables Reference Section */}
                      <div className="bg-muted/50 p-4 rounded-md space-y-2">
                        <h4 className="font-medium text-sm">Available Variables</h4>
                        <div className="grid gap-2">
                          {availableVariables[prompt.type].map((variable) => (
                            <div key={variable.name} className="text-sm">
                              <code className="bg-muted px-1 py-0.5 rounded">
                                {`{{${variable.name}}}`}
                              </code>
                              <span className="text-muted-foreground ml-2">
                                - {variable.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

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
                    </div>
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
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Select Prompts to Test</h3>
                  <div className="border rounded-lg p-4">
                    {prompts?.map((prompt) => (
                      <div key={prompt.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          checked={selectedPrompts?.includes(prompt.id)}
                          onCheckedChange={(checked) => {
                            setSelectedPrompts(prev =>
                              checked
                                ? [...(prev || []), prompt.id]
                                : prev?.filter(id => id !== prompt.id)
                            );
                          }}
                        />
                        <span>{workflowTitles[prompt.type]}</span>
                      </div>
                    ))}
                  </div>
                </div>

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
                                checked={selectedProjects?.includes(project.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedProjects(prev => 
                                    checked 
                                      ? [...(prev || []), project.id]
                                      : prev?.filter(id => id !== project.id)
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
                    disabled={isTestingPrompts || !selectedProjects?.length}
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
                            {result.results.map((promptResult, index) => (
                              <div key={index} className="space-y-2">
                                <h4 className="font-medium">
                                  {workflowTitles[promptResult.type]}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                      Actual Prompt Sent to API
                                    </h5>
                                    <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                                      {promptResult.finalPrompt}
                                    </pre>
                                  </div>
                                  <div>
                                    <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                      Response
                                    </h5>
                                    <pre className="whitespace-pre-wrap bg-muted p-4 rounded-md text-sm">
                                      {promptResult.output}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
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
