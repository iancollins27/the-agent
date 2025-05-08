
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ChatInterface from '@/components/Chat/ChatInterface';
import ToolDefinitionsPanel from '@/components/admin/MCP/ToolDefinitionsPanel';
import MCPInfoAlert from '@/components/admin/test-runner/MCPInfoAlert';

type ModelOption = 'gpt-4o-mini' | 'gpt-4o';

interface ChatbotConfig {
  id: string;
  system_prompt: string;
  model: ModelOption;
  temperature: number;
  search_project_data: boolean;
  enable_mcp?: boolean;
  mcp_tool_definitions?: string;
  available_tools?: string[];
  created_at: string;
}

const ChatbotConfig = () => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.7);
  const [searchProjectData, setSearchProjectData] = useState(true);
  const [testMessage, setTestMessage] = useState('');
  const [enableMCP, setEnableMCP] = useState(false);
  const [mcpToolDefinitions, setMcpToolDefinitions] = useState('');
  const [availableTools, setAvailableTools] = useState<string[]>(['create_action_record', 'knowledge_base_lookup']);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentSystemPrompt();
  }, []);

  const fetchCurrentSystemPrompt = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chatbot_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error('Error fetching system prompt:', error);
        setSystemPrompt(
          `You are an intelligent project assistant that helps manage project workflows.
Answer questions about projects or workflow processes. If you don't know something, say so clearly.
When asked about schedules or timelines, check the summary and next_step fields for relevant information.
If no scheduling information is found, suggest contacting the project manager for more details.`
        );
      } else if (data) {
        const config = data as ChatbotConfig;
        setSystemPrompt(config.system_prompt);
        setSelectedModel(config.model || 'gpt-4o-mini');
        setTemperature(config.temperature || 0.7);
        setSearchProjectData(config.search_project_data !== false);
        
        // Set MCP configuration if available
        if (config.enable_mcp !== undefined) {
          setEnableMCP(config.enable_mcp);
        }
        
        if (config.mcp_tool_definitions) {
          setMcpToolDefinitions(config.mcp_tool_definitions);
        } else {
          // Set default tool definitions if none exist
          setMcpToolDefinitions(getDefaultToolDefinitions());
        }
        
        if (config.available_tools && Array.isArray(config.available_tools)) {
          setAvailableTools(config.available_tools);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDefaultToolDefinitions = () => {
    return JSON.stringify([
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
            }
          },
          "required": ["action_type"]
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
      }
    ], null, 2);
  };

  const saveConfiguration = async () => {
    setIsSaving(true);
    try {
      const configData = {
        system_prompt: systemPrompt,
        model: selectedModel,
        temperature: temperature,
        search_project_data: searchProjectData,
        enable_mcp: enableMCP,
        mcp_tool_definitions: mcpToolDefinitions,
        available_tools: availableTools
      };
      
      const { error } = await supabase
        .from('chatbot_config')
        .insert(configData);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Configuration Saved",
        description: "The chatbot configuration has been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save chatbot configuration.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToolDefinitionsSave = (updatedDefinitions: string) => {
    setMcpToolDefinitions(updatedDefinitions);
    
    // Extract tool names from the updated definitions
    try {
      const toolDefs = JSON.parse(updatedDefinitions);
      const toolNames = toolDefs.map((tool: any) => tool.name);
      setAvailableTools(toolNames);
    } catch (error) {
      console.error('Error parsing tool definitions:', error);
    }
    
    toast({
      title: "Tool Definitions Updated",
      description: "Changes will be saved when you click 'Save Configuration'",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Chatbot Configuration</h1>
        <p className="text-muted-foreground">Customize the AI project assistant's behavior</p>
      </header>

      <Tabs defaultValue="prompt">
        <TabsList>
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="settings">Model Settings</TabsTrigger>
          <TabsTrigger value="mcp">MCP Configuration</TabsTrigger>
          <TabsTrigger value="test">Test Interface</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Prompt</CardTitle>
              <CardDescription>
                This is the instruction that primes the AI assistant's behavior and knowledge. 
                This prompt will be sent at the beginning of every conversation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Textarea 
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  placeholder="Enter system prompt..."
                />
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={saveConfiguration} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Model Settings</CardTitle>
              <CardDescription>
                Configure the AI model parameters to adjust the assistant's responses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <select 
                  id="model" 
                  className="w-full border border-input bg-background px-3 py-2 rounded-md"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (Faster, cheaper)</option>
                  <option value="gpt-4o">GPT-4o (More powerful)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">
                  Temperature: {temperature}
                </Label>
                <Input 
                  id="temperature" 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Lower values make responses more deterministic. Higher values make responses more creative.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch 
                  id="search-project-data" 
                  checked={searchProjectData}
                  onCheckedChange={setSearchProjectData}
                />
                <Label htmlFor="search-project-data">Search project data when CRM ID is mentioned</Label>
              </div>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-md">
                <h3 className="font-medium mb-2">Knowledge Base Integration</h3>
                <p className="text-sm">
                  To connect your company's knowledge base to the chatbot, please visit the{" "}
                  <a href="/company-settings" className="text-primary hover:underline">
                    Company Settings
                  </a>{" "}
                  page and set up your integration.
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={saveConfiguration} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Model Context Protocol (MCP) Settings</CardTitle>
              <CardDescription>
                Configure how the chatbot interacts with tools and external systems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch 
                  id="enable-mcp" 
                  checked={enableMCP}
                  onCheckedChange={setEnableMCP}
                />
                <Label htmlFor="enable-mcp">Enable Model Context Protocol</Label>
              </div>

              {enableMCP && <MCPInfoAlert />}

              {enableMCP && (
                <ToolDefinitionsPanel 
                  rawDefinitions={mcpToolDefinitions}
                  onSave={handleToolDefinitionsSave}
                  isSaving={isSaving}
                />
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={saveConfiguration} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Test Message</CardTitle>
              <CardDescription>
                Enter a test message to simulate a user interaction with the configured bot
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input 
                value={testMessage} 
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="e.g., What is the status of project CRM ID 12345?"
                className="mb-4"
              />
              <p className="text-sm text-muted-foreground mb-2">
                Tip: Try including a CRM ID to test the project data lookup functionality
              </p>
            </CardContent>
          </Card>
          
          <div className="h-[600px]">
            <ChatInterface projectId={undefined} presetMessage={testMessage} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatbotConfig;
