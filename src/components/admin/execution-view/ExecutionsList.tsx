import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PromptRun, WorkflowType } from '@/types/workflow';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import PromptRunFilters from '../PromptRunFilters';
import { useTimeFilter } from '@/hooks/useTimeFilter';
import { supabase } from '@/integrations/supabase/client';
import ExecutionsListItem from './ExecutionsListItem';
import ExecutionsListSkeleton from './ExecutionsListSkeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import ExecutionsEmptyState from './ExecutionsEmptyState';

export const DEFAULT_PAGE_SIZE = 10;

const ExecutionsList: React.FC = () => {
  // State for filters
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [onlyShowMyProjects, setOnlyShowMyProjects] = useState(false);
  const [projectManagerFilter, setProjectManagerFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { timeFilter, setTimeFilter, getDateFilter } = useTimeFilter();
  
  // Fetch user profile
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return data;
    }
  });
  
  // Query to fetch prompt runs with tool calls
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['executionsList', statusFilter, onlyShowMyProjects, projectManagerFilter, timeFilter, currentPage],
    queryFn: async () => {
      if (!userProfile?.profile_associated_company) {
        return { promptRuns: [], totalCount: 0 };
      }
      
      // Fetch prompt runs that have associated tool logs
      let query = supabase
        .from('prompt_runs')
        .select('*, tool_logs!inner(*)', { count: 'exact' })
        .eq('status', 'COMPLETED');
      
      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      // Apply date filter
      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      
      // Calculate pagination
      const from = (currentPage - 1) * DEFAULT_PAGE_SIZE;
      const to = from + DEFAULT_PAGE_SIZE - 1;
      
      // Apply pagination
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);
        
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      // Process the runs to format dates and extract tool logs
      const processedRuns: PromptRun[] = data.map((run: any) => {
        // Get workflow type from the joined workflow_prompts table or from the run directly
        const workflowType = run.workflow_type || 
          (run.workflow_prompts ? run.workflow_prompts.type : null);
          
        return {
          ...run,
          relative_time: formatDistanceToNow(new Date(run.created_at), { addSuffix: true }),
          tool_logs_count: run.tool_logs?.length || 0,
          workflow_type: workflowType
        };
      });
      
      // Additional filtering for project managers if needed
      let filteredRuns = processedRuns;
      
      if (projectManagerFilter) {
        // Fetch projects with the selected manager
        const { data: projectsWithManager } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', projectManagerFilter);
          
        if (projectsWithManager) {
          const projectIds = new Set(projectsWithManager.map(p => p.id));
          filteredRuns = filteredRuns.filter(run => 
            run.project_id && projectIds.has(run.project_id)
          );
        }
      }
      
      if (onlyShowMyProjects && userProfile?.id) {
        // Fetch projects managed by the current user
        const { data: myProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('project_manager', userProfile.id);
          
        if (myProjects) {
          const myProjectIds = new Set(myProjects.map(p => p.id));
          filteredRuns = filteredRuns.filter(run => 
            run.project_id && myProjectIds.has(run.project_id)
          );
        }
      }
      
      return { 
        promptRuns: filteredRuns, 
        totalCount: count || filteredRuns.length 
      };
    },
    enabled: !!userProfile
  });
  
  const totalPages = data ? Math.ceil(data.totalCount / DEFAULT_PAGE_SIZE) : 0;
  
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Agent Executions</CardTitle>
        <PromptRunFilters 
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onlyShowMyProjects={onlyShowMyProjects}
          onMyProjectsChange={setOnlyShowMyProjects}
          projectManagerFilter={projectManagerFilter}
          onProjectManagerFilterChange={setProjectManagerFilter}
          onRefresh={() => refetch()}
          hideStatusFilter={true} // We're already filtering for COMPLETED runs
        />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ExecutionsListSkeleton />
        ) : data?.promptRuns && data.promptRuns.length > 0 ? (
          <div className="space-y-4">
            {data.promptRuns.map((run: PromptRun) => (
              <ExecutionsListItem key={run.id} promptRun={run} />
            ))}
          </div>
        ) : (
          <ExecutionsEmptyState />
        )}
      </CardContent>
      {data?.totalCount && data.totalCount > DEFAULT_PAGE_SIZE && (
        <CardFooter>
          <Pagination className="w-full">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Logic to show pages around current page
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink 
                      isActive={pageNum === currentPage}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
      )}
    </Card>
  );
};

export default ExecutionsList;
