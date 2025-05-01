
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to handle MCP-related functionality
 */
export const useMCPTools = () => {
  const [useMCP, setUseMCP] = useState<boolean>(false);
  const [availableTools, setAvailableTools] = useState<string[]>([]);

  // Check if MCP Orchestrator prompt is selected
  const hasMCPOrchestrator = async (promptIds: string[]): Promise<boolean> => {
    if (promptIds.length === 0) return false;
    
    const { data } = await supabase
      .from('workflow_prompts')
      .select('type')
      .in('id', promptIds);
      
    return data?.some(prompt => prompt.type === 'mcp_orchestrator') || false;
  };
  
  // Fetch available tools when MCP mode changes
  useEffect(() => {
    const fetchTools = async () => {
      if (useMCP) {
        // In a real implementation, we'd fetch this from a backend endpoint
        // that accesses the tool registry
        setAvailableTools([
          'detect_action', 
          'create_action_record',
          'knowledge_base_lookup'
          // Adding more tools as they become available
        ]);
      } else {
        setAvailableTools([]);
      }
    };
    
    fetchTools();
  }, [useMCP]);
  
  // Get available tools based on MCP mode
  const getAvailableTools = (useMCPMode: boolean): string[] => {
    if (!useMCPMode) return [];
    
    return availableTools;
  };

  return {
    useMCP,
    setUseMCP,
    hasMCPOrchestrator,
    getAvailableTools,
    availableTools
  };
};
