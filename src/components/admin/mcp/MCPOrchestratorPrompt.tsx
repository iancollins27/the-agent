
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mcpOrchestratorTemplate } from './MCPOrchestratorTemplate';

// For TypeScript, define the expected structure
interface WorkflowPrompt {
  id?: string;
  created_at?: string;
  updated_at?: string;
  prompt_text: string;
  type: string;
}

const MCPOrchestratorPrompt = () => {
  const [promptText, setPromptText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the MCP orchestrator prompt
  const { data: prompt, isLoading } = useQuery({
    queryKey: ['mcp-orchestrator-prompt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('*')
        .eq('type', 'mcp_orchestrator')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data as WorkflowPrompt | null;
    }
  });

  // Create or update the MCP orchestrator prompt
  const mutation = useMutation({
    mutationFn: async (newPrompt: { id?: string; prompt_text: string }) => {
      if (newPrompt.id) {
        // Update existing prompt
        const { error } = await supabase
          .from('workflow_prompts')
          .update({ prompt_text: newPrompt.prompt_text })
          .eq('id', newPrompt.id);
          
        if (error) throw error;
        return { ...prompt, prompt_text: newPrompt.prompt_text };
      } else {
        // Create new prompt with raw SQL to bypass TypeScript limitations
        // This is a workaround for the type issue
        const { data, error } = await supabase.rpc('create_mcp_orchestrator_prompt', {
          p_prompt_text: newPrompt.prompt_text
        });
          
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-orchestrator-prompt'] });
      toast({
        title: prompt ? "Prompt Updated" : "Prompt Created",
        description: "The MCP orchestrator prompt has been saved successfully.",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to save prompt: ${error.message}`,
      });
    }
  });

  // Set prompt text when data is loaded
  useEffect(() => {
    if (prompt?.prompt_text) {
      setPromptText(prompt.prompt_text);
    }
  }, [prompt]);

  const handleApplyTemplate = () => {
    setPromptText(mcpOrchestratorTemplate);
  };

  const handleSave = () => {
    if (!promptText.trim()) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Prompt text cannot be empty.",
      });
      return;
    }
    
    mutation.mutate({ 
      id: prompt?.id, 
      prompt_text: promptText 
    });
  };

  const handleCreateNew = () => {
    setPromptText(mcpOrchestratorTemplate);
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!prompt && !isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MCP Orchestrator Prompt</CardTitle>
          <CardDescription>
            No MCP orchestrator prompt found. Create one to enable advanced Model Context Protocol features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateNew} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Create MCP Orchestrator Prompt
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP Orchestrator Prompt</CardTitle>
        <CardDescription>
          This system prompt guides the AI in using tools efficiently through the Model Context Protocol.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div className="flex justify-end mb-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleApplyTemplate}
                className="flex items-center"
              >
                <Wand2 className="mr-1 h-3 w-3" />
                Apply Template
              </Button>
            </div>
            <Textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  if (prompt?.prompt_text) {
                    setPromptText(prompt.prompt_text);
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                    Saving...
                  </>
                ) : (
                  'Save Prompt'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-auto whitespace-pre-wrap max-h-[400px]">
              {prompt?.prompt_text || ''}
            </pre>
            <Button onClick={() => setIsEditing(true)}>
              Edit Prompt
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MCPOrchestratorPrompt;
