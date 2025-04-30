
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to handle MCP-related functionality
 */
export const useMCPTools = () => {
  const [useMCP, setUseMCP] = useState<boolean>(false);

  // Check if MCP Orchestrator prompt is selected
  const hasMCPOrchestrator = async (promptIds: string[]): Promise<boolean> => {
    if (promptIds.length === 0) return false;
    
    const { data } = await supabase
      .from('workflow_prompts')
      .select('type')
      .in('id', promptIds);
      
    return data?.some(prompt => prompt.type === 'mcp_orchestrator') || false;
  };
  
  // Get available tools based on MCP mode
  const getAvailableTools = (useMCPMode: boolean): string[] => {
    if (!useMCPMode) return [];
    
    return [
      'detect_action', 
      'create_action_record'
      // Removing 'knowledge_base_lookup' from available tools
    ];
  };

  return {
    useMCP,
    setUseMCP,
    hasMCPOrchestrator,
    getAvailableTools,
  };
};
