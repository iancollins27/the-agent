
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PromptRun } from '@/components/admin/types';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ExecutionsList: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasToolCalls, setHasToolCalls] = useState(false);

  // Function to fetch executions
  const fetchExecutions = async () => {
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
    
    if (searchTerm) {
      query = query.or(`prompt_input.ilike.%${searchTerm}%,projects.crm_id.ilike.%${searchTerm}%`);
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
    queryKey: ['executions', currentPage, pageSize, statusFilter, searchTerm, hasToolCalls],
    queryFn: fetchExecutions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Handle filter changes
  const handleFilterChange = (value: string) => {
    setStatusFilter(value === 'all' ? null : value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Calculate page links to display
  const getPageLinks = () => {
    const pageLinks = [];
    const maxPagesToShow = 5;
    
    // Always show first page
    pageLinks.push(1);
    
    // Calculate start and end of page range around current page
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    
    // Adjust if we're near the start or end
    if (currentPage <= 3) {
      endPage = Math.min(totalPages - 1, maxPagesToShow - 1);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - maxPagesToShow + 2);
    }
    
    // Add ellipsis after first page if needed
    if (startPage > 2) {
      pageLinks.push('ellipsis1');
    }
    
    // Add pages in the middle
    for (let i = startPage; i <= endPage; i++) {
      pageLinks.push(i);
    }
    
    // Add ellipsis before last page if needed
    if (endPage < totalPages - 1) {
      pageLinks.push('ellipsis2');
    }
    
    // Always show last page if there's more than one page
    if (totalPages > 1) {
      pageLinks.push(totalPages);
    }
    
    return pageLinks;
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
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search executions..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" variant="outline">Search</Button>
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
              onClick={() => setHasToolCalls(!hasToolCalls)}
              size="sm"
              className="gap-2"
            >
              {hasToolCalls ? "✓ " : ""} With Tool Calls
            </Button>
          </div>

          {/* Refresh Button */}
          <div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="icon"
              disabled={isFetching}
              title="Refresh executions"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

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
                            <Link to={`/admin/executions/${execution.id}`}>View Details</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-muted-foreground">No executions found</div>
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
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => handlePageChange(currentPage - 1)}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {getPageLinks().map((page, i) => (
                    page === 'ellipsis1' || page === 'ellipsis2' ? (
                      <PaginationItem key={`ellipsis-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={`page-${page}`}>
                        <PaginationLink
                          onClick={() => handlePageChange(page as number)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => handlePageChange(currentPage + 1)} 
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExecutionsList;
