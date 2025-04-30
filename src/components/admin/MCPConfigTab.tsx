
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Info, AlertTriangle } from 'lucide-react';
import MCPOrchestratorPrompt from './mcp/MCPOrchestratorPrompt';

const MCPConfigTab: React.FC = () => {
  const { data: mcpStats, isLoading } = useQuery({
    queryKey: ['mcp-stats'],
    queryFn: async () => {
      // Get count of MCP vs non-MCP runs
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: totalRuns, error: countError } = await supabase
        .from('prompt_runs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());
        
      if (countError) throw countError;
      
      // Count tool logs (as a proxy for MCP runs)
      const { data: toolLogData, error: toolLogError } = await supabase
        .from('tool_logs')
        .select('prompt_run_id', { count: 'exact', head: false })
        .gte('created_at', thirtyDaysAgo.toISOString());
        
      if (toolLogError) throw toolLogError;
      
      // Get unique prompt runs with tool logs
      const mcpRunIds = new Set(toolLogData?.map(log => log.prompt_run_id));
      const mcpRunsCount = mcpRunIds.size;
      
      return {
        totalRuns: totalRuns || 0,
        mcpRuns: mcpRunsCount,
        nonMcpRuns: (totalRuns || 0) - mcpRunsCount,
        mcpPercentage: totalRuns ? Math.round((mcpRunsCount / totalRuns) * 100) : 0
      };
    }
  });
  
  const { data: orchestratorPrompt } = useQuery({
    queryKey: ['mcp-orchestrator-prompt-exists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_prompts')
        .select('id')
        .eq('type', 'mcp_orchestrator')
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return !!data;
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Model Context Protocol (MCP) Configuration</h2>
        <p className="text-muted-foreground">
          Configure the orchestration layer that guides AI decision making and tool usage through structured prompts.
        </p>
      </div>
      
      {!orchestratorPrompt && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">MCP Orchestrator Not Configured</AlertTitle>
          <AlertDescription className="text-yellow-700">
            You need to create an MCP orchestrator prompt to enable advanced tool-using capabilities.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">MCP Usage</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-muted-foreground">Loading statistics...</div>
            ) : (
              <>
                <div className="text-3xl font-bold">{mcpStats?.mcpPercentage || 0}%</div>
                <p className="text-sm text-muted-foreground">
                  {mcpStats?.mcpRuns || 0} of {mcpStats?.totalRuns || 0} runs used MCP
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Available Tools</CardTitle>
            <CardDescription>Tools the MCP orchestrator can use</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 p-3 rounded-md border">
                <div className="font-medium">detect_action</div>
                <div className="text-xs text-muted-foreground">Determines if actions are needed</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-md border">
                <div className="font-medium">generate_action</div>
                <div className="text-xs text-muted-foreground">Creates specific action records</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-md border">
                <div className="font-medium">knowledge_base_lookup</div>
                <div className="text-xs text-muted-foreground">Searches project knowledge base</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-md border">
                <div className="font-medium">analyze_timeline</div>
                <div className="text-xs text-muted-foreground">Analyzes project timeline & milestones</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="orchestrator" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orchestrator">Orchestrator Prompt</TabsTrigger>
          <TabsTrigger value="tools" disabled>Tool Definitions</TabsTrigger>
          <TabsTrigger value="settings" disabled>Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="orchestrator" className="space-y-4">
          <MCPOrchestratorPrompt />
          
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">About the Orchestrator Prompt</AlertTitle>
            <AlertDescription className="text-blue-700">
              <p>The orchestrator prompt serves as the system instruction for the AI when operating in MCP mode. 
              It guides the AI in using tools effectively and making decisions based on project context.</p>
              <p className="mt-2">Use variables like <code>&#123;&#123;summary&#125;&#125;</code> and <code>&#123;&#123;project_id&#125;&#125;</code> to 
              incorporate dynamic project information.</p>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MCPConfigTab;
