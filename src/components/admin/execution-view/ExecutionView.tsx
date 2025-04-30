
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Info } from 'lucide-react';
import Tool from '../../icons/Tool';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import PromptInput from './tabs/PromptInput';
import PromptOutput from './tabs/PromptOutput';
import ToolLogs from './tabs/ToolLogs';
import ProjectContext from './tabs/ProjectContext';

const ExecutionView: React.FC = () => {
  const { executionId } = useParams();
  const [activeTab, setActiveTab] = useState("prompt-input");
  
  const { data: execution, isLoading, error } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: async () => {
      // Fetch the prompt run
      const { data: promptRun, error: promptRunError } = await supabase
        .from('prompt_runs')
        .select(`
          id,
          created_at,
          status,
          ai_provider,
          ai_model,
          prompt_input,
          prompt_output,
          error_message,
          prompt_tokens,
          completion_tokens,
          usd_cost,
          workflow_prompt_id,
          project_id,
          workflow_prompts(type)
        `)
        .eq('id', executionId)
        .single();

      if (promptRunError) throw promptRunError;

      // Fetch related tool logs if any
      const { data: toolLogs, error: toolLogsError } = await supabase
        .from('tool_logs')
        .select('*')
        .eq('prompt_run_id', executionId)
        .order('created_at', { ascending: true });

      if (toolLogsError) console.error("Error fetching tool logs:", toolLogsError);

      // Get project details if available
      let project = null;
      if (promptRun.project_id) {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select(`
            id,
            summary,
            next_step,
            project_track,
            Address,
            crm_id
          `)
          .eq('id', promptRun.project_id)
          .single();

        if (!projectError) project = projectData;
        else console.error("Error fetching project:", projectError);
      }

      return {
        promptRun,
        toolLogs: toolLogs || [],
        project
      };
    },
    enabled: !!executionId,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  const isMCPExecution = (execution?.toolLogs?.length || 0) > 0;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading execution data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-3xl mt-8">
        <AlertTitle>Error Loading Execution</AlertTitle>
        <AlertDescription>
          There was a problem loading the execution data: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!execution) {
    return (
      <Alert className="mx-auto max-w-3xl mt-8">
        <Info className="h-5 w-5" />
        <AlertTitle>No Data Found</AlertTitle>
        <AlertDescription>
          No execution found with the ID: {executionId}
        </AlertDescription>
      </Alert>
    );
  }

  const { promptRun, toolLogs, project } = execution;

  // Format timestamps for better readability
  const formattedCreatedAt = new Date(promptRun.created_at).toLocaleString();
  const workflowType = promptRun.workflow_prompts?.type || 'Unknown';
  const modelName = promptRun.ai_model || 'Unknown Model';

  // Add toolLogsCount to promptRun for PromptInput component
  promptRun.toolLogsCount = toolLogs.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Execution Details</h1>
          <p className="text-muted-foreground">
            {formattedCreatedAt} • {workflowType} • {modelName}
          </p>
        </div>
        
        {isMCPExecution && (
          <div className="flex items-center bg-blue-50 text-blue-800 px-3 py-1 rounded-md">
            <Tool className="h-4 w-4 mr-1" />
            <span className="font-medium">MCP Execution</span>
            <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-600 border-blue-200">
              {toolLogs.length} Tool Calls
            </Badge>
          </div>
        )}
      </div>

      {project && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center">
              Project Context
              <span className="text-xs text-gray-500 ml-2 font-normal">
                (ID: {project.id})
              </span>
            </CardTitle>
            <CardDescription>
              {project.Address || 'No address available'}
              {project.crm_id && ` • CRM ID: ${project.crm_id}`}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="prompt-input">Input</TabsTrigger>
          <TabsTrigger value="prompt-output">Output</TabsTrigger>
          <TabsTrigger value="tool-logs" disabled={!isMCPExecution}>
            Tool Logs ({toolLogs.length})
          </TabsTrigger>
          <TabsTrigger value="project-context">Context</TabsTrigger>
        </TabsList>
        
        <TabsContent value="prompt-input" className="mt-4">
          <PromptInput promptRun={promptRun} />
        </TabsContent>
        
        <TabsContent value="prompt-output" className="mt-4">
          <PromptOutput promptRun={promptRun} />
        </TabsContent>
        
        <TabsContent value="tool-logs" className="mt-4">
          <ToolLogs toolLogs={toolLogs} />
        </TabsContent>
        
        <TabsContent value="project-context" className="mt-4">
          <ProjectContext project={project} />
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/40">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Provider</div>
              <div className="font-medium">{promptRun.ai_provider || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Model</div>
              <div className="font-medium">{promptRun.ai_model || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status</div>
              <div className="font-medium capitalize">{promptRun.status.toLowerCase()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Cost</div>
              <div className="font-medium">
                ${promptRun.usd_cost ? (typeof promptRun.usd_cost === 'number' ? promptRun.usd_cost.toFixed(4) : parseFloat(String(promptRun.usd_cost)).toFixed(4)) : '0.0000'}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t bg-muted/20 px-6 py-3">
          <div className="flex justify-between w-full text-xs text-muted-foreground">
            <div>Prompt Tokens: {promptRun.prompt_tokens || 'Unknown'}</div>
            <div>Completion Tokens: {promptRun.completion_tokens || 'Unknown'}</div>
            <div>Execution ID: {promptRun.id.slice(0, 8)}</div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ExecutionView;
