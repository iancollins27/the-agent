
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PromptEditor from "./PromptEditor";
import { WorkflowPrompt } from "@/types/workflow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import ToolDefinitionsPanel from "./MCP/ToolDefinitionsPanel";
import PromptVariablesReference from "./PromptVariablesReference";

const MCPConfigTab = () => {
  const queryClient = useQueryClient();
  const [editingPrompt, setEditingPrompt] = useState<WorkflowPrompt | null>(null);
  const [toolDefinitions, setToolDefinitions] = useState("[]");

  // Fetch the Tool Orchestrator prompt
  const { data: prompts, isLoading: isLoadingPrompts, error: promptsError } = useQuery({
    queryKey: ['mcp-orchestrator-prompt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('*')
        .eq('type', 'tool_orchestrator')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching Tool Orchestrator prompt:', error);
        throw error;
      }
      
      return data as WorkflowPrompt[];
    }
  });

  // Fetch tool definitions
  const { isLoading: isLoadingTools } = useQuery({
    queryKey: ['mcp-tool-definitions'],
    queryFn: async () => {
      try {
        // This would typically fetch from an API or database
        // For now, we'll use a default set of tool definitions
        const defaultTools = [
          {
            type: "function",
            name: "create_action_record",
            description: "Create an action record in the system",
            parameters: {
              type: "object",
              properties: {
                action_type: {
                  type: "string",
                  enum: ["message", "reminder", "update", "notification"],
                  description: "Type of action to create"
                },
                decision: {
                  type: "string",
                  enum: ["ACTION_NEEDED", "NO_ACTION", "DEFER"],
                  description: "Decision about the action"
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Priority level for the action"
                },
                message: {
                  type: "string",
                  description: "Message content for the action"
                },
                sender: {
                  type: "string",
                  description: "Who is sending the message or creating the action"
                },
                recipient: {
                  type: "string",
                  description: "Who is receiving the message or action"
                },
                description: {
                  type: "string",
                  description: "Brief description of what this action does"
                },
                reason: {
                  type: "string",
                  description: "Why this action is needed"
                }
              },
              required: ["action_type", "decision"]
            }
          },
          {
            type: "function",
            name: "knowledge_base_lookup",
            description: "Search the knowledge base for information",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query"
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return"
                }
              },
              required: ["query"]
            }
          }
        ];
        
        const toolsJson = JSON.stringify(defaultTools, null, 2);
        setToolDefinitions(toolsJson);
        return defaultTools;
      } catch (error) {
        console.error('Error fetching tool definitions:', error);
        throw error;
      }
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
      queryClient.invalidateQueries({ queryKey: ['mcp-orchestrator-prompt'] });
      setEditingPrompt(null);
    }
  });

  const createPromptMutation = useMutation({
    mutationFn: async () => {
      const defaultPrompt = `You are an AI orchestrator using the Model Context Protocol. Your job is to analyze the project and determine what actions need to be taken.

Project Summary:
{{summary}}

Project Track: {{track_name}}
Track Roles: {{track_roles}}
Track Base Prompt: {{track_base_prompt}}
Current Date: {{current_date}}
Next Step: {{next_step}}
Property Address: {{property_address}}
Is Reminder Check: {{is_reminder_check}}

Project Contacts:
{{project_contacts}}

Available Tools:
{{available_tools}}

Follow these steps:
1. Analyze the current state of the project based on the summary and context
2. Determine if any action is needed using the detect_action tool
3. If an action is needed, specify what type of action using the appropriate tool
4. If knowledge is needed, use the knowledge_base_lookup tool
5. Be specific in your reasoning and explanations

Remember:
- Think step by step
- Be specific about what actions are needed
- Provide clear reasoning for your decisions`;

      const { data, error } = await supabase
        .from('workflow_prompts')
        .insert({
          type: 'tool_orchestrator',
          prompt_text: defaultPrompt
        })
        .select();
      
      if (error) throw error;
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-orchestrator-prompt'] });
    }
  });

  const handleSaveToolDefinitions = (definitions: string) => {
    setToolDefinitions(definitions);
    // In a real implementation, you'd save this to the database
    console.log('Tool definitions saved:', definitions);
  };

  if (promptsError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Error loading MCP configuration: {promptsError.message}</AlertDescription>
      </Alert>
    );
  }

  if (isLoadingPrompts) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const mcpPrompt = prompts && prompts.length > 0 ? prompts[0] : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Model Context Protocol Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Configure the Model Context Protocol (MCP) orchestrator prompt and tool definitions.
          </p>
          
          {!mcpPrompt ? (
            <div className="flex flex-col items-center justify-center p-6 border rounded-md">
              <p className="mb-4 text-muted-foreground">No Tool Orchestrator prompt configured.</p>
              <Button 
                onClick={() => createPromptMutation.mutate()}
                disabled={createPromptMutation.isPending}
              >
                {createPromptMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  'Create Default MCP Prompt'
                )}
              </Button>
            </div>
          ) : (
            <>
              <PromptEditor
                prompt={mcpPrompt}
                currentEditingId={editingPrompt?.id || null}
                onEdit={setEditingPrompt}
                onCancel={() => setEditingPrompt(null)}
                updatePromptMutation={updatePromptMutation}
              />
              {editingPrompt && (
                <PromptVariablesReference
                  promptType="tool_orchestrator"
                  isEditing={!!editingPrompt}
                  onInsertVariable={(variable) => {
                    const textarea = document.querySelector('textarea[name="prompt_text"]') as HTMLTextAreaElement;
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = textarea.value;
                      const before = text.substring(0, start);
                      const after = text.substring(end, text.length);
                      textarea.value = before + `{{${variable}}}` + after;
                      textarea.focus();
                      textarea.selectionStart = start + variable.length + 4;
                      textarea.selectionEnd = start + variable.length + 4;
                      
                      // Update the form state
                      const event = new Event('input', { bubbles: true });
                      textarea.dispatchEvent(event);
                    }
                  }}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ToolDefinitionsPanel 
        rawDefinitions={toolDefinitions}
        onSave={handleSaveToolDefinitions}
        isSaving={false}
      />
    </div>
  );
};

export default MCPConfigTab;
