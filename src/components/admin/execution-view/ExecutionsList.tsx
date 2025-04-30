
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExecutionsListItem from './ExecutionsListItem';
import { PromptRun } from '../types';

const ExecutionsList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  
  const { data: executions, isLoading, error } = useQuery({
    queryKey: ['executions', workflowFilter],
    queryFn: async () => {
      // Build query
      let query = supabase
        .from('prompt_runs')
        .select(`
          id, 
          created_at,
          status,
          ai_provider,
          ai_model,
          prompt_input,
          prompt_output,
          workflow_prompts(type),
          project_id,
          projects(name:summary, address:Address)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      // Apply workflow filter if not 'all'
      if (workflowFilter !== 'all') {
        query = query.eq('workflow_prompts.type', workflowFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get tool log counts for each prompt run
      // This helps identify MCP runs
      const promptRunIds = data.map(run => run.id);
      const { data: toolLogCounts, error: toolLogsError } = await supabase
        .from('tool_logs')
        .select('prompt_run_id, count')
        .in('prompt_run_id', promptRunIds)
        .select('prompt_run_id')
        .then(res => {
          // Create a map of prompt run ID to tool log count
          const counts = new Map();
          res.data?.forEach(item => {
            counts.set(item.prompt_run_id, (counts.get(item.prompt_run_id) || 0) + 1);
          });
          return { data: counts, error: res.error };
        });
      
      if (toolLogsError) {
        console.error('Error fetching tool log counts:', toolLogsError);
      }
      
      // Format the results and add relative time
      const formattedExecutions = data.map(run => {
        const createdAt = new Date(run.created_at);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
        
        let relativeTime;
        if (diffInSeconds < 60) {
          relativeTime = `${diffInSeconds} seconds ago`;
        } else if (diffInSeconds < 3600) {
          relativeTime = `${Math.floor(diffInSeconds / 60)} minutes ago`;
        } else if (diffInSeconds < 86400) {
          relativeTime = `${Math.floor(diffInSeconds / 3600)} hours ago`;
        } else {
          relativeTime = `${Math.floor(diffInSeconds / 86400)} days ago`;
        }
        
        return {
          ...run,
          relative_time: relativeTime,
          workflow_type: run.workflow_prompts?.type || null,
          project_name: run.projects?.name || null,
          project_address: run.projects?.address || null,
          tool_logs_count: toolLogCounts?.data?.get(run.id) || 0
        };
      });
      
      return formattedExecutions;
    },
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
  
  // Filter executions based on search query
  const filteredExecutions = executions?.filter(execution => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    
    return (
      (execution.workflow_type?.toLowerCase().includes(searchLower)) ||
      (execution.project_name?.toLowerCase().includes(searchLower)) ||
      (execution.project_address?.toLowerCase().includes(searchLower)) ||
      (execution.ai_model?.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/15 text-destructive p-4 rounded-md">
        <h2 className="font-semibold mb-2">Error Loading Executions</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex-1">
          <Label htmlFor="search" className="text-sm">Search</Label>
          <Input
            id="search"
            placeholder="Search by project name, address, workflow type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <Label htmlFor="workflow-filter" className="text-sm">Workflow Type</Label>
          <Select value={workflowFilter} onValueChange={setWorkflowFilter}>
            <SelectTrigger id="workflow-filter">
              <SelectValue placeholder="Filter by workflow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              <SelectItem value="summary_generation">Summary Generation</SelectItem>
              <SelectItem value="summary_update">Summary Update</SelectItem>
              <SelectItem value="action_detection_execution">Action Detection & Execution</SelectItem>
              <SelectItem value="multi_project_analysis">Multi-Project Analysis</SelectItem>
              <SelectItem value="multi_project_message_generation">Message Generation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredExecutions?.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No executions found matching your criteria.
          </div>
        )}
        
        {filteredExecutions?.map((execution) => (
          <ExecutionsListItem key={execution.id} promptRun={execution as PromptRun} />
        ))}
      </div>
    </div>
  );
};

export default ExecutionsList;
