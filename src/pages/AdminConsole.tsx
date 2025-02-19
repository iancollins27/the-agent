
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type WorkflowType = 'summary_generation' | 'summary_update' | 'action_detection' | 'action_execution';

type WorkflowPrompt = {
  id: number;
  type: WorkflowType;
  prompt_text: string;
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

  const { data: prompts, isLoading, error } = useQuery({
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-destructive/15 text-destructive p-4 rounded-md">
          <h2 className="font-semibold mb-2">Error Loading Admin Console</h2>
          <p>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflow Prompts Admin</h1>
          <p className="text-muted-foreground">Manage AI workflow prompts</p>
        </div>
      </header>

      {isLoading ? (
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
    </div>
  );
};

export default AdminConsole;

