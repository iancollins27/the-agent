
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

/**
 * Hook for managing the orchestrator prompt
 */
export function useOrchestratorPrompt() {
  const [orchestratorText, setOrchestratorText] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the MCP orchestrator prompt from the database
  const { data: mcpPrompt, isLoading: promptLoading } = useQuery({
    queryKey: ['mcp-orchestrator-prompt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('*')
        .eq('type', 'mcp_orchestrator')
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching MCP orchestrator prompt:', error);
        throw error;
      }
      
      return data;
    }
  });

  // Update the orchestrator text state when the prompt data is loaded
  useEffect(() => {
    if (mcpPrompt?.prompt_text) {
      setOrchestratorText(mcpPrompt.prompt_text);
    }
  }, [mcpPrompt]);

  // Update the MCP orchestrator prompt in the database
  const updateOrchestratorMutation = useMutation({
    mutationFn: async (promptText: string) => {
      if (!mcpPrompt?.id) {
        throw new Error('No MCP orchestrator prompt found to update');
      }
      
      const { error } = await supabase
        .from('workflow_prompts')
        .update({ 
          prompt_text: promptText,
          updated_at: new Date().toISOString()
        })
        .eq('id', mcpPrompt.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-orchestrator-prompt'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-prompts'] });
      toast({
        title: "MCP Orchestrator Updated",
        description: "The MCP orchestrator prompt has been successfully updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update MCP orchestrator: ${error.message}`,
      });
    }
  });

  // Handler for saving the orchestrator prompt
  const handleSaveOrchestrator = () => {
    updateOrchestratorMutation.mutate(orchestratorText);
  };

  return {
    orchestratorText,
    setOrchestratorText,
    promptLoading,
    handleSaveOrchestrator,
    isUpdating: updateOrchestratorMutation.isPending
  };
}
