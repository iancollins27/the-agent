import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WorkflowPrompt, WorkflowType } from "@/types/workflow";
import PromptEditor from "./PromptEditor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const PromptsTab = () => {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<WorkflowPrompt | null>(null);
  const [missingPrompts, setMissingPrompts] = useState<WorkflowType[]>([]);

  const allowedPromptTypes: WorkflowType[] = [
    'summary_generation', 
    'summary_update', 
    'action_detection_execution',
    'multi_project_analysis',
    'multi_project_message_generation'
  ];

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
      
      const filteredPrompts = data?.filter(prompt => 
        allowedPromptTypes.includes(prompt.type as WorkflowType)
      ) || [];
      
      const foundTypes = filteredPrompts.map(p => p.type);
      console.log('Found prompt types:', foundTypes);
      
      const missingTypes = allowedPromptTypes.filter(
        type => !foundTypes.includes(type as any)
      ) as WorkflowType[];
      console.log('Missing prompt types:', missingTypes);
      setMissingPrompts(missingTypes);
      
      return filteredPrompts as WorkflowPrompt[];
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

  const createPromptMutation = useMutation({
    mutationFn: async (promptType: WorkflowType) => {
      let defaultPromptText = `This is a placeholder prompt for ${promptType}. Please update it with appropriate content.`;
      
      if (promptType === 'multi_project_message_generation') {
        defaultPromptText = `You need to create a consolidated message to send to a roofer named {{rooferName}} regarding multiple projects that require their attention.

These are the projects and their details:
{{projectData}}

Your task:
1. Analyze each project's latest prompt run and pending actions
2. Group projects with similar required actions or status
3. Create a concise but comprehensive message that:
   - Greets the roofer by name
   - Mentions each project (using the address as identifier)
   - Clearly states what is needed from the roofer for each project
   - Groups similar actions when possible
   - Maintains a professional but friendly tone
   - Ends with an appropriate closing
   - Keeps the message under 500 words
   - ONLY includes actionable items that require the roofer's attention

Return ONLY the final message text, with no additional explanations.`;
      }

      const { data, error } = await supabase
        .from('workflow_prompts')
        .insert({ 
          type: promptType,
          prompt_text: defaultPromptText
        })
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-prompts'] });
      toast({
        title: "Prompt Created",
        description: "A new workflow prompt has been created.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create prompt: ${error.message}`,
      });
    }
  });

  const handleCreateMissingPrompt = (promptType: WorkflowType) => {
    createPromptMutation.mutate(promptType);
  };

  if (promptsError) {
    return (
      <div className="bg-destructive/15 text-destructive p-4 rounded-md">
        <h2 className="font-semibold mb-2">Error Loading Prompts</h2>
        <p>{promptsError.message}</p>
      </div>
    );
  }

  if (isLoadingPrompts) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!prompts?.length && missingPrompts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No workflow prompts found. Please make sure the workflow_prompts table exists and contains data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      {missingPrompts.length > 0 && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <p className="mb-2">Some expected prompts are missing from the database:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {missingPrompts.map(type => (
                <Button 
                  key={type} 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleCreateMissingPrompt(type)}
                  disabled={createPromptMutation.isPending}
                  className="border-yellow-300 hover:bg-yellow-100"
                >
                  {createPromptMutation.isPending ? (
                    <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Creating...</>
                  ) : (
                    <>Create "{type}" prompt</>
                  )}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {prompts?.map((prompt) => (
        <PromptEditor
          key={prompt.id}
          prompt={prompt}
          currentEditingId={editingPrompt?.id || null}
          onEdit={setEditingPrompt}
          onCancel={() => setEditingPrompt(null)}
          updatePromptMutation={updatePromptMutation}
        />
      ))}
    </div>
  );
};

export default PromptsTab;
