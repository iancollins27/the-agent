
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ChatbotConfig, ChatbotConfigUpdateInput } from '../types';

/**
 * Hook for managing tool configurations
 */
export function useToolConfiguration() {
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    create_action_record: true,
    identify_project: true,
    knowledge_base_lookup: false,
    data_fetch: true
  });
  const [toolDefinitions, setToolDefinitions] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      
      return data as ChatbotConfig;
    }
  });

  // Update the enabled tools state when the chatbot config is loaded
  useEffect(() => {
    if (chatbotConfig) {
      const toolsState: Record<string, boolean> = {
        create_action_record: false,
        identify_project: false,
        knowledge_base_lookup: false,
        data_fetch: false
      };
      
      // Mark tools as enabled based on the config
      const availableTools = chatbotConfig.available_tools || [];
      availableTools.forEach((tool: string) => {
        if (tool in toolsState) {
          toolsState[tool] = true;
        }
      });
      
      setEnabledTools(toolsState);
    }
  }, [chatbotConfig]);

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

      // Use the ChatbotConfigUpdateInput type for the update payload
      const updatePayload: ChatbotConfigUpdateInput = { available_tools: tools };

      console.log("Updating tools with payload:", updatePayload);

      const { error } = await supabase
        .from('chatbot_config')
        .update(updatePayload)
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

  // Handler for saving tool definitions
  const handleSaveToolDefinitions = (updatedDefinitions: string) => {
    setToolDefinitions(updatedDefinitions);
    toast({
      title: "Tool Definitions Updated",
      description: "The MCP tool definitions have been successfully updated.",
    });
  };

  // Load initial tool definitions
  useEffect(() => {
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

  return {
    enabledTools,
    toolDefinitions,
    configLoading,
    handleToggleTool,
    handleSaveToolDefinitions
  };
}
