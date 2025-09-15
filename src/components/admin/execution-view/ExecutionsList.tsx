
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PromptRun } from '@/components/admin/types';
import { supabase } from '@/integrations/supabase/client';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Search, Filter, RefreshCw } from 'lucide-react';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TablePagination from '@/components/admin/tables/TablePagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/use-debounce';

const ExecutionsList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL params or defaults
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page');
    return page ? parseInt(page, 10) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const size = searchParams.get('size');
    return size ? parseInt(size, 10) : 10;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(() => {
    return searchParams.get('status') || null;
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    return searchParams.get('search') || '';
  });
  const [hasToolCalls, setHasToolCalls] = useState(() => {
    return searchParams.get('toolCalls') === 'true';
  });

  // Debounce search term to avoid too many queries
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Function to fetch executions
  const fetchExecutions = async () => {
    let matchingProjectIds: string[] = [];
    
    // If there's a search term, first find matching projects
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .or(`crm_id.ilike.%${debouncedSearchTerm}%,Address.ilike.%${debouncedSearchTerm}%,project_name.ilike.%${debouncedSearchTerm}%`);
      
      if (projects) {
        matchingProjectIds = projects.map(p => p.id);
      }
    }

    // Start with the base query
    let query = supabase
      .from('prompt_runs')
      .select(`
        id,
        created_at,
        status,
        ai_provider,
        ai_model,
        prompt_input,
        completed_at,
        workflow_prompt_id,
        workflow_prompts:workflow_prompts (type),
        project_id,
        projects:project_id (
          id, 
          crm_id, 
          Address
        ),
        prompt_tokens,
        completion_tokens,
        usd_cost,
        tool_logs!tool_logs_prompt_run_id_fkey (count)
      `, 
      { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    
    // Apply search filters
    if (debouncedSearchTerm && debouncedSearchTerm.trim()) {
      const searchConditions = [];
      
      // Search in prompt_input
      searchConditions.push(`prompt_input.ilike.%${debouncedSearchTerm}%`);
      
      // If we found matching projects, include them
      if (matchingProjectIds.length > 0) {
        query = query.or(`prompt_input.ilike.%${debouncedSearchTerm}%,project_id.in.(${matchingProjectIds.join(',')})`);
      } else {
        // Only search in prompt_input if no projects matched
        query = query.ilike('prompt_input', `%${debouncedSearchTerm}%`);
      }
    }

    if (hasToolCalls) {
      const { data: promptRunsWithToolCalls } = await supabase
        .from('tool_logs')
        .select('prompt_run_id')
        .order('created_at', { ascending: false });
      
      if (promptRunsWithToolCalls && promptRunsWithToolCalls.length > 0) {
        const promptRunIds = [...new Set(promptRunsWithToolCalls.map(log => log.prompt_run_id))];
        query = query.in('id', promptRunIds);
      } else {
        return { data: [], count: 0 };
      }
    }

    // Pagination
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching executions:', error);
      throw error;
    }

    // Calculate total pages
    if (count !== null) {
      setTotalPages(Math.ceil(count / pageSize));
    }

    // Now for each prompt_run, fetch associated tool logs count
    const runsWithToolInfo = await Promise.all((data || []).map(async (run) => {
      const { count: toolLogsCount } = await supabase
        .from('tool_logs')
        .select('*', { count: 'exact', head: true })
        .eq('prompt_run_id', run.id);
      
      return {
        ...run,
        toolLogsCount: toolLogsCount || 0
      };
    }));

    return { data: runsWithToolInfo, count: count || 0 };
  };

  // Query for executions
  const { data: executions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['executions', currentPage, pageSize, statusFilter, debouncedSearchTerm, hasToolCalls],
    queryFn: fetchExecutions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Function to update URL params
  const updateURLParams = (updates: Partial<{
    page: number;
    size: number;
    status: string | null;
    search: string;
    toolCalls: boolean;
  }>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || (key === 'toolCalls' && !value)) {
        newParams.delete(key);
      } else {
        newParams.set(key, String(value));
      }
    });
    
    setSearchParams(newParams);
  };

  // Handle filter changes
  const handleFilterChange = (value: string) => {
    const newStatus = value === 'all' ? null : value;
    setStatusFilter(newStatus);
    setCurrentPage(1);
    updateURLParams({ status: newStatus, page: 1 });
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
    updateURLParams({ search: newSearchTerm, page: 1 });
  };

  // Handle search form submission (for explicit search button)
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    updateURLParams({ search: searchTerm, page: 1 });
  };

  // Handle Enter key in search input
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setCurrentPage(1);
      updateURLParams({ search: searchTerm, page: 1 });
    }
  };

  // Handle pagination - revised to properly handle navigation
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
      updateURLParams({ page });
    }
  };

  // Handle page size changes
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    updateURLParams({ size: newPageSize, page: 1 });
  };

  // Format the status for display
  const formatStatus = (status: string) => {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return <Badge variant="outline">Pending</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Completed</Badge>;
      case 'ERROR':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getWorkflowType = (run: any): string => {
    if (run.workflow_prompts && run.workflow_prompts.type) {
      return run.workflow_prompts.type.replace(/_/g, ' ');
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold">Execution History</h1>
        
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Refresh Button */}
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
          
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search executions, projects, addresses..."
                className="pl-8 min-w-[250px]"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
              />
            </div>
            <Button type="submit" variant="outline" disabled={isFetching}>
              Search
            </Button>
          </form>
          
          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <Select value={statusFilter || 'all'} onValueChange={handleFilterChange}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Tool Calls Filter */}
           <div>
            <Button 
              variant={hasToolCalls ? "default" : "outline"} 
              onClick={() => {
                const newHasToolCalls = !hasToolCalls;
                setHasToolCalls(newHasToolCalls);
                setCurrentPage(1);
                updateURLParams({ toolCalls: newHasToolCalls, page: 1 });
              }}
              size="sm"
              className="gap-2"
            >
              {hasToolCalls ? "✓ " : ""} With Tool Calls
            </Button>
          </div>
        </div>
      </div>

      {/* Show search results info */}
      {debouncedSearchTerm && (
        <div className="text-sm text-muted-foreground">
          {isFetching ? 'Searching...' : `Search results for "${debouncedSearchTerm}"`}
          {executions?.count !== undefined && ` (${executions.count} result${executions.count !== 1 ? 's' : ''})`}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading executions...</span>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Execution ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-center">Tool Calls</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions?.data && executions.data.length > 0 ? (
                    executions.data.map((execution: any) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-mono text-xs">
                          {execution.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>{new Date(execution.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(execution.created_at), { addSuffix: true })}
                          </div>
                        </TableCell>
                        <TableCell>{formatStatus(execution.status)}</TableCell>
                        <TableCell>{getWorkflowType(execution)}</TableCell>
                        <TableCell>
                          {execution.projects ? (
                            <div>
                              <div className="font-medium">{execution.projects.crm_id || 'N/A'}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-40">
                                {execution.projects.Address || 'No address'}
                              </div>
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {execution.toolLogsCount > 0 ? (
                            <Badge variant="secondary">{execution.toolLogsCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </TableCell>
                         <TableCell className="text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link 
                              to={`/admin/executions/${execution.id}?${searchParams.toString()}`}
                            >
                              View Details
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {debouncedSearchTerm ? 'No executions found matching your search' : 'No executions found'}
                        </div>
                        <Button variant="outline" className="mt-2" onClick={() => refetch()}>
                          Refresh
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                pageSize={pageSize}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExecutionsList;
