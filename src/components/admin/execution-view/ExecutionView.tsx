
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun, ToolLog } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import ExecutionViewSkeleton from './ExecutionViewSkeleton';
import ExecutionToolCall from './ExecutionToolCall';
import PromptSection from '../prompt-details/PromptSection';

const ExecutionView: React.FC = () => {
  const { executionId } = useParams();
  const navigate = useNavigate();
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  
  // Fetch the prompt run and its tool logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['executionDetail', executionId],
    queryFn: async () => {
      if (!executionId) return null;
      
      // Fetch the prompt run
      const { data: promptRun, error: promptRunError } = await supabase
        .from('prompt_runs')
        .select('*')
        .eq('id', executionId)
        .single();
        
      if (promptRunError) throw promptRunError;
      
      // Fetch tool logs for this run
      const { data: toolLogs, error: toolLogsError } = await supabase
        .from('tool_logs')
        .select('*')
        .eq('prompt_run_id', executionId)
        .order('created_at', { ascending: true });
        
      if (toolLogsError) throw toolLogsError;
      
      // Format the data
      const formattedRun: PromptRun = {
        ...promptRun,
        relative_time: formatDistanceToNow(new Date(promptRun.created_at), { addSuffix: true })
      };
      
      // Add sequence numbers to tool logs
      const formattedToolLogs: ToolLog[] = toolLogs.map((log, index) => ({
        ...log,
        sequence: index + 1,
        // Attempt to parse the output trim (which is often JSON)
        output: (() => {
          try {
            return JSON.parse(log.output_trim);
          } catch (e) {
            return log.output_trim;
          }
        })()
      }));
      
      return {
        promptRun: formattedRun,
        toolLogs: formattedToolLogs
      };
    }
  });
  
  // Handle back navigation
  const handleBack = () => {
    navigate('/admin/executions');
  };
  
  // Toggle tool call expansion
  const toggleToolExpand = (toolId: string) => {
    if (expandedToolId === toolId) {
      setExpandedToolId(null);
    } else {
      setExpandedToolId(toolId);
    }
  };
  
  if (isLoading) return <ExecutionViewSkeleton />;
  
  if (error || !data) {
    return (
      <Card className="max-w-4xl mx-auto my-6">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <h3 className="text-lg font-medium text-gray-900">Error Loading Execution</h3>
            <p className="mt-2 text-sm text-gray-500">
              There was an error loading the execution details.
            </p>
            <Button onClick={handleBack} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Executions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const { promptRun, toolLogs } = data;
  
  return (
    <div className="max-w-4xl mx-auto my-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Executions
        </Button>
        
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-500">
            {format(new Date(promptRun.created_at), 'PPpp')}
          </span>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <CardTitle>{promptRun.project_name || 'Unnamed Project'}</CardTitle>
              <CardDescription>
                {promptRun.project_address && (
                  <span className="block">{promptRun.project_address}</span>
                )}
                <span>{promptRun.ai_provider} • {promptRun.ai_model}</span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {promptRun.workflow_type && (
                <Badge variant="outline">{promptRun.workflow_type}</Badge>
              )}
              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                {toolLogs.length} Tool Calls
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Initial Prompt */}
            <div className="border rounded-md p-4 bg-slate-50">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <Badge variant="secondary" className="mr-2">PROMPT</Badge>
                Initial Input
              </h3>
              <pre className="text-sm whitespace-pre-wrap text-gray-700">{promptRun.prompt_input}</pre>
            </div>
            
            {/* Tool Calls Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Execution Steps</h3>
              
              <div className="space-y-3">
                {toolLogs.map((toolLog) => (
                  <ExecutionToolCall 
                    key={toolLog.id}
                    toolLog={toolLog}
                    isExpanded={expandedToolId === toolLog.id}
                    onToggle={() => toggleToolExpand(toolLog.id)}
                  />
                ))}
              </div>
            </div>
            
            {/* Final Result */}
            <div className="border-t pt-4 mt-6">
              <h3 className="text-lg font-medium mb-4">Final Result</h3>
              <PromptSection 
                title="Response"
                content={promptRun.prompt_output || 'No response data available'}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutionView;
