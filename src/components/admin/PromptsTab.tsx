
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WorkflowPrompt } from "@/types/workflow";
import PromptEditor from "./PromptEditor";

const PromptsTab = () => {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<WorkflowPrompt | null>(null);

  const allowedPromptTypes = [
    'summary_generation', 
    'summary_update', 
    'action_detection_execution',
    'multi_project_analysis',
    'multi_project_message_generation'  // Added new prompt type
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
        allowedPromptTypes.includes(prompt.type)
      ) || [];
      
      console.log('Fetched prompts:', filteredPrompts);
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

  if (!prompts?.length) {
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
      {prompts.map((prompt) => (
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
