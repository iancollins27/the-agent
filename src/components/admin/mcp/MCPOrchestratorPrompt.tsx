
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { defaultMCPOrchestratorPrompt } from '@/data/defaultMCPOrchestratorPrompt';
import PromptVariablesReference from '../PromptVariablesReference';
import { availableVariables } from '@/types/workflow';

export const MCPOrchestratorPrompt: React.FC = () => {
  const [promptText, setPromptText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: prompt, isLoading, error } = useQuery({
    queryKey: ['mcp-orchestrator-prompt'],
    queryFn: async () => {
      try {
        // Try to fetch existing MCP orchestrator prompt
        const { data, error } = await supabase
          .from('workflow_prompts')
          .select('*')
          .eq('type', 'mcp_orchestrator')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code === 'PGRST116') {
          // No MCP orchestrator prompt exists yet
          return null;
        }
        
        if (error) throw error;
        return data;
      } catch (err) {
        console.error('Error fetching MCP orchestrator prompt:', err);
        return null;
      }
    },
  });
  
  // Create MCP orchestrator prompt if it doesn't exist
  const createPromptMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      const { data, error } = await supabase.rpc('create_mcp_orchestrator_prompt', {
        prompt_text: promptText
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['mcp-orchestrator-prompt'] });
      toast({
        title: "MCP Orchestrator Prompt Created",
        description: "The prompt has been successfully created.",
      });
    },
    onError: (error) => {
      setIsSaving(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to create prompt: ${error.message}`,
      });
    }
  });
  
  // Update MCP orchestrator prompt
  const updatePromptMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      const { error } = await supabase
        .from('workflow_prompts')
        .update({ prompt_text: promptText })
        .eq('id', prompt?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['mcp-orchestrator-prompt'] });
      toast({
        title: "MCP Orchestrator Prompt Updated",
        description: "The prompt has been successfully updated.",
      });
    },
    onError: (error) => {
      setIsSaving(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update prompt: ${error.message}`,
      });
    }
  });
  
  // Set default prompt text if no prompt exists
  useEffect(() => {
    if (!isLoading) {
      if (prompt) {
        setPromptText(prompt.prompt_text);
      } else {
        setPromptText(defaultMCPOrchestratorPrompt);
      }
    }
  }, [isLoading, prompt]);
  
  const handleSave = () => {
    if (prompt) {
      updatePromptMutation.mutate();
    } else {
      createPromptMutation.mutate();
    }
  };
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">Loading orchestrator prompt...</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error Loading Prompt</AlertTitle>
        <AlertDescription>
          {error.message || "Failed to load the MCP orchestrator prompt."}
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold">MCP Orchestrator System Prompt</CardTitle>
        <CardDescription>
          Define the system prompt used for advanced Model Context Protocol interactions.
          This prompt provides guidance to the AI on how to orchestrate tool usage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="orchestrator-prompt">System Prompt</Label>
            <Textarea
              id="orchestrator-prompt"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Enter the MCP orchestrator system prompt..."
              className="min-h-[350px] font-mono text-sm"
            />
          </div>
          
          <PromptVariablesReference variables={availableVariables.mcp_orchestrator} />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t p-4">
        <div className="text-sm text-muted-foreground">
          {prompt ? "Last updated: " + new Date(prompt.updated_at).toLocaleString() : "New prompt"}
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="ml-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : showSuccess ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Saved
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
