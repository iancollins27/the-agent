
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, Loader2, Check, X } from "lucide-react";
import Tool from '../icons/Tool';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ToolDefinitionsPanel from './MCP/ToolDefinitionsPanel';

/**
 * MCP Configuration Tab for controlling the MCP (Model Context Protocol) settings
 */
const MCPConfigTab: React.FC = () => {
  const [orchestratorText, setOrchestratorText] = useState<string>('');
  const [toolDefinitions, setToolDefinitions] = useState<string>('');
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    create_action_record: true,
    identify_project: true,
    knowledge_base_lookup: false,
    data_fetch: true
  });
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

  // Fetch the chatbot config to get enabled tools
  const { data: chatbotConfig, isLoading: configLoading } = useQuery({
    queryKey: ['chatbot-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error('Error fetching chatbot config:', error);
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

  // Update the enabled tools state when the chatbot config is loaded
  useEffect(() => {
    if (chatbotConfig?.available_tools) {
      const toolsState: Record<string, boolean> = {
        create_action_record: false,
        identify_project: false,
        knowledge_base_lookup: false,
        data_fetch: false
      };
      
      // Mark tools as enabled based on the config
      chatbotConfig.available_tools.forEach((tool: string) => {
        if (tool in toolsState) {
          toolsState[tool] = true;
        }
      });
      
      setEnabledTools(toolsState);
    }
  }, [chatbotConfig]);

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

  // Update the chatbot config in the database
  const updateToolsMutation = useMutation({
    mutationFn: async (tools: string[]) => {
      const { data: existingConfig, error: fetchError } = await supabase
        .from('chatbot_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch current config: ${fetchError.message}`);
      }

      const { error } = await supabase
        .from('chatbot_config')
        .update({ available_tools: tools })
        .eq('id', existingConfig.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-config'] });
      toast({
        title: "Tool Configuration Updated",
        description: "The available tools for the chatbot have been updated.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update tools configuration: ${error.message}`,
      });
    }
  });

  // Handler for saving the orchestrator prompt
  const handleSaveOrchestrator = () => {
    updateOrchestratorMutation.mutate(orchestratorText);
  };

  // Handler for saving tool definitions
  const handleSaveToolDefinitions = (updatedDefinitions: string) => {
    setToolDefinitions(updatedDefinitions);
    toast({
      title: "Tool Definitions Updated",
      description: "The MCP tool definitions have been successfully updated.",
    });
  };

  // Handler for toggling tool enablement
  const handleToggleTool = (toolName: string, enabled: boolean) => {
    const updatedTools = {
      ...enabledTools,
      [toolName]: enabled
    };
    
    setEnabledTools(updatedTools);
    
    // Save the updated tools configuration
    const enabledToolNames = Object.entries(updatedTools)
      .filter(([_, isEnabled]) => isEnabled)
      .map(([name]) => name);
      
    updateToolsMutation.mutate(enabledToolNames);
    
    toast({
      title: enabled ? "Tool Enabled" : "Tool Disabled",
      description: `The ${toolName} tool has been ${enabled ? 'enabled' : 'disabled'}.`,
    });
  };

  // Fetch tool definitions from the edge function
  useEffect(() => {
    // For now, we'll use our static tool definitions
    // In a real implementation, we would fetch this data from an endpoint
    // that connects to the tool registry
    setToolDefinitions(`[
  {
    "name": "create_action_record",
    "description": "Creates a specific action for team members to execute based on the project's needs.",
    "parameters": {
      "type": "object",
      "properties": {
        "action_type": {
          "type": "string",
          "enum": ["message", "data_update", "set_future_reminder", "human_in_loop", "knowledge_query"],
          "description": "The type of action to be taken"
        },
        "description": {
          "type": "string",
          "description": "Detailed description of what needs to be done"
        },
        "recipient": {
          "type": "string",
          "description": "Who should receive this action"
        },
        "message_text": {
          "type": "string",
          "description": "For message actions, the content of the message"
        },
        "sender": {
          "type": "string",
          "description": "For message actions, who is sending the message"
        }
      },
      "required": ["action_type"]
    }
  },
  {
    "name": "identify_project",
    "description": "Identifies projects based on ID, CRM ID, or semantic search of description. Use this to find relevant projects when the user mentions a project or asks about a specific project.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query (project ID, CRM ID, address, or descriptive text)"
        },
        "company_id": {
          "type": "string",
          "description": "Optional company ID to filter search to specific company"
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "knowledge_base_lookup",
    "description": "Searches the knowledge base for relevant information about the project",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query to find relevant information"
        },
        "limit": {
          "type": "integer",
          "description": "Maximum number of results to return"
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "data_fetch",
    "description": "Fetches comprehensive data for a specific project including details, contacts, communications, tasks and notes",
    "parameters": {
      "type": "object",
      "properties": {
        "project_id": {
          "type": "string", 
          "description": "UUID of the project to fetch data for"
        },
        "include_raw": {
          "type": "boolean",
          "description": "Whether to include raw provider data in the response (defaults to false)"
        }
      },
      "required": ["project_id"]
    }
  }
]`);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">MCP Configuration</h2>
          <p className="text-muted-foreground">Configure the Model Context Protocol settings</p>
        </div>
      </div>

      <Alert>
        <Tool className="h-4 w-4" />
        <AlertTitle>About MCP</AlertTitle>
        <AlertDescription>
          The Model Context Protocol (MCP) enables sophisticated tool calling and orchestration patterns for AI models.
          Configure the system prompts and tool definitions used by the AI when making decisions.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="orchestrator" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orchestrator">Orchestrator Prompt</TabsTrigger>
          <TabsTrigger value="tools">Tool Definitions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="orchestrator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MCP Orchestrator System Prompt</CardTitle>
              <CardDescription>
                This system prompt guides the AI in using tools and making decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {promptLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Loading prompt...</span>
                </div>
              ) : (
                <>
                  <Textarea
                    className="min-h-[300px] font-mono"
                    value={orchestratorText}
                    onChange={(e) => setOrchestratorText(e.target.value)}
                  />

                  <div className="flex justify-end mt-4">
                    <Button 
                      onClick={handleSaveOrchestrator}
                      disabled={updateOrchestratorMutation.isPending}
                    >
                      {updateOrchestratorMutation.isPending ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : "Save Changes"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Tools</CardTitle>
              <CardDescription>
                Enable or disable tools available to the MCP orchestrator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4">
                  <ToolConfigCard
                    name="create_action_record"
                    title="Create Action Record"
                    description="Creates specific action records based on the orchestrator's decisions"
                    enabled={enabledTools.create_action_record}
                    onToggle={(enabled) => handleToggleTool('create_action_record', enabled)}
                    required={true}
                  />

                  <ToolConfigCard
                    name="identify_project"
                    title="Identify Project"
                    description="Searches and identifies projects based on descriptions, addresses, or IDs"
                    enabled={enabledTools.identify_project}
                    onToggle={(enabled) => handleToggleTool('identify_project', enabled)}
                    required={true}
                  />

                  <ToolConfigCard
                    name="knowledge_base_lookup"
                    title="Knowledge Base Lookup"
                    description="Searches the knowledge base for relevant information"
                    enabled={enabledTools.knowledge_base_lookup}
                    onToggle={(enabled) => handleToggleTool('knowledge_base_lookup', enabled)}
                    required={false}
                    disabled={true}
                    disabledReason="Currently disabled in the system"
                  />

                  <ToolConfigCard
                    name="data_fetch"
                    title="Data Fetch"
                    description="Fetches data from integrated CRM systems"
                    enabled={enabledTools.data_fetch}
                    onToggle={(enabled) => handleToggleTool('data_fetch', enabled)}
                    required={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <ToolDefinitionsPanel 
            rawDefinitions={toolDefinitions}
            onSave={handleSaveToolDefinitions}
            isSaving={false}
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>MCP Settings</CardTitle>
              <CardDescription>
                Configure how the MCP system operates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium">Default AI Provider</label>
                  <select className="w-full mt-1 border rounded p-2">
                    <option value="openai">OpenAI</option>
                    <option value="claude">Claude</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">Default AI Model</label>
                  <select className="w-full mt-1 border rounded p-2">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface ToolConfigCardProps {
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const ToolConfigCard: React.FC<ToolConfigCardProps> = ({ 
  name, 
  title, 
  description, 
  enabled, 
  onToggle,
  required = false,
  disabled = false,
  disabledReason
}) => {
  return (
    <Card className={`overflow-hidden ${disabled ? 'opacity-60' : ''}`}>
      <CardContent className="p-0">
        <div className="flex items-start p-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium">{title}</h3>
              {required && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Required
                </span>
              )}
              {disabled && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
            {disabledReason && (
              <p className="text-xs text-amber-600 mt-1">{disabledReason}</p>
            )}
          </div>
          <div className="ml-4 flex items-center space-x-2">
            <Switch
              id={`toggle-${name}`}
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={required || disabled}
            />
            <Label htmlFor={`toggle-${name}`} className="sr-only">
              Enable {title}
            </Label>
            {enabled ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <X className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MCPConfigTab;
