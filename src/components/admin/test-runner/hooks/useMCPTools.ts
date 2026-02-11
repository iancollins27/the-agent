import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to handle MCP-related functionality with tool call limits
 */
export const useMCPTools = () => {
  const [useMCP, setUseMCP] = useState<boolean>(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  const [toolLimits, setToolLimits] = useState<Record<string, number>>({
    // Tool limits can be added here if needed in the future
  });

  // Check if Tool Orchestrator prompt is selected
  const hasMCPOrchestrator = async (promptIds: string[]): Promise<boolean> => {
    if (promptIds.length === 0) return false;
    
    const { data } = await supabase
      .from('workflow_prompts')
      .select('type')
      .in('id', promptIds);
      
    return data?.some(prompt => prompt.type === 'tool_orchestrator') || false;
  };
  
  // Fetch available tools when MCP mode changes
  useEffect(() => {
    const fetchTools = async () => {
      if (useMCP) {
        // Set the available tools for MCP mode - removed identify_project
        const tools = [
          'create_action_record',
          'knowledge_base_lookup',
          'read_crm_data',
          'crm_data_write',
          'email_summary'
        ];
        
        console.log('Setting available MCP tools:', tools);
        setAvailableTools(tools);
      } else {
        setAvailableTools([]);
      }
    };
    
    fetchTools();
  }, [useMCP]);
  
  // Get available tools based on MCP mode
  const getAvailableTools = (useMCPMode: boolean): string[] => {
    if (!useMCPMode) {
      console.log('MCP mode disabled, returning no tools');
      return [];
    }
    
    const tools = [
      'create_action_record',
      'knowledge_base_lookup',
      'read_crm_data',
      'crm_data_write',
      'email_summary'
    ];
    
    console.log('MCP mode enabled, returning tools:', tools);
    return tools;
  };
  
  // Get the limit for a specific tool
  const getToolLimit = (toolName: string): number => {
    return toolLimits[toolName] || 0; // 0 means no limit
  };
  
  // Update the limit for a specific tool
  const setToolLimit = (toolName: string, limit: number): void => {
    setToolLimits(prev => ({
      ...prev,
      [toolName]: limit
    }));
  };

  return {
    useMCP,
    setUseMCP,
    hasMCPOrchestrator,
    getAvailableTools,
    availableTools,
    getToolLimit,
    setToolLimit,
    toolLimits
  };
};
