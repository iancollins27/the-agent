
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PromptRunsTable from '../PromptRunsTable';
import PromptRunDetails from '../PromptRunDetails';
import { PromptRun } from '../types';
import PromptRunHeader from './PromptRunHeader';
import PromptRunLoader from './PromptRunLoader';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePromptRunActions } from './usePromptRunActions';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { usePagination } from '@/hooks/usePagination';
import { Button } from "@/components/ui/button";
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem
} from "@/components/ui/pagination";

const PromptRunsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("not-reviewed");
  const { toast } = useToast();
  const pagination = usePagination({ pageSize: 20 });

  const {
    data: promptRunsResponse,
    isLoading: loading,
    refetch: fetchPromptRuns,
    error
  } = useQuery({
    queryKey: ['promptRuns', statusFilter, pagination.currentPage],
    queryFn: async () => {
      try {
        // First, get prompt runs data with pagination
        let query = supabase
          .from('prompt_runs')
          .select(`
            id, 
            project_id,
            workflow_prompt_id,
            prompt_input,
            prompt_output,
            error_message,
            status,
            created_at,
            completed_at,
            feedback_rating,
            feedback_description,
            feedback_tags,
            reviewed,
            ai_provider,
            ai_model,
            projects:project_id (crm_id, Address)
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(pagination.from, pagination.to);
            
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }
        
        const { data: runsData, error: runsError, count } = await query;
        
        if (runsError) throw runsError;
        
        // Get all prompt run IDs for the current page
        const promptRunIds = runsData?.map((run: any) => run.id) || [];
        
        // Get pending actions count for each prompt run - using a more efficient approach
        let pendingActionsMap: Record<string, number> = {};
        
        if (promptRunIds.length > 0) {
          // Get counts of pending actions for each prompt run
          const { data: actionCounts, error: actionsError } = await supabase
            .rpc('count_pending_actions_by_prompt_run', {
              prompt_run_ids: promptRunIds
            });
          
          if (!actionsError && actionCounts) {
            pendingActionsMap = actionCounts.reduce((acc: Record<string, number>, item: any) => {
              acc[item.prompt_run_id] = item.count;
              return acc;
            }, {});
          } else if (actionsError) {
            console.error('Error fetching action counts:', actionsError);
            
            // Fallback method if the RPC doesn't exist
            const { data: actionData, error: fallbackError } = await supabase
              .from('action_records')
              .select('prompt_run_id, status')
              .in('prompt_run_id', promptRunIds)
              .eq('status', 'pending');
              
            if (!fallbackError && actionData) {
              actionData.forEach(action => {
                const runId = action.prompt_run_id;
                pendingActionsMap[runId] = (pendingActionsMap[runId] || 0) + 1;
              });
            } else {
              console.error('Error in fallback action count method:', fallbackError);
            }
          }
        }
        
        // Format data to include project information
        const formattedData = runsData?.map((run: any) => ({
          ...run,
          project_name: run.projects?.crm_id || 'Unknown Project',
          project_address: run.projects?.Address || null,
          workflow_prompt_type: 'Unknown Type',
          pending_actions: pendingActionsMap[run.id] || 0
        })) as PromptRun[];

        return { data: formattedData, totalCount: count };
      } catch (error) {
        console.error('Error fetching prompt runs:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });

  // Handle any errors from React Query
  if (error) {
    toast({
      variant: "destructive",
      title: "Error",
      description: `Failed to load prompt runs: ${(error as Error).message}`,
    });
  }

  // Custom hook for prompt run actions
  const { handleRatingChange, handleFeedbackChange } = usePromptRunActions(
    (updater) => {
      // This is a safer way to update state based on a function
      // that doesn't create a dependency on promptRuns
      if (promptRunsResponse?.data) {
        const updatedRuns = updater(promptRunsResponse.data);
        // No need to set state here, just return the updated runs
        return updatedRuns;
      }
      return [];
    },
    setSelectedRun
  );

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handleRunReviewed = (promptRunId: string) => {
    // We should fetch the data again to stay consistent
    fetchPromptRuns();
  };

  // Filter runs based on review status
  const filteredPromptRuns = React.useMemo(() => {
    if (!promptRunsResponse?.data) return [];
    
    if (reviewFilter === "all") return promptRunsResponse.data;
    if (reviewFilter === "reviewed") return promptRunsResponse.data.filter(run => run.reviewed);
    if (reviewFilter === "not-reviewed") return promptRunsResponse.data.filter(run => !run.reviewed);
    
    return promptRunsResponse.data;
  }, [promptRunsResponse?.data, reviewFilter]);

  const totalPages = promptRunsResponse?.totalCount 
    ? Math.ceil(promptRunsResponse.totalCount / pagination.pageSize)
    : 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PromptRunHeader 
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          fetchPromptRuns={() => fetchPromptRuns()}
        />
        <div className="flex items-center space-x-4">
          <Label>Show:</Label>
          <RadioGroup 
            value={reviewFilter} 
            onValueChange={setReviewFilter}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="show-all" />
              <Label htmlFor="show-all">All</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="reviewed" id="show-reviewed" />
              <Label htmlFor="show-reviewed">Reviewed</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="not-reviewed" id="show-not-reviewed" />
              <Label htmlFor="show-not-reviewed">Not Reviewed</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {loading ? (
        <PromptRunLoader />
      ) : filteredPromptRuns.length === 0 ? (
        <EmptyPromptRunsState />
      ) : (
        <>
          <PromptRunsTable 
            promptRuns={filteredPromptRuns} 
            onRatingChange={handleRatingChange} 
            onViewDetails={viewPromptRunDetails} 
            onRunReviewed={handleRunReviewed}
            reviewFilter={reviewFilter}
          />
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button 
                  variant="outline"
                  onClick={pagination.previousPage}
                  disabled={pagination.currentPage === 1}
                  className="gap-1"
                >
                  Previous
                </Button>
              </PaginationItem>
              <PaginationItem>
                <div className="flex items-center mx-4">
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.currentPage} of {totalPages}
                  </span>
                </div>
              </PaginationItem>
              <PaginationItem>
                <Button 
                  variant="outline"
                  onClick={pagination.nextPage}
                  disabled={pagination.currentPage >= totalPages}
                  className="gap-1"
                >
                  Next
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </>
      )}

      <PromptRunDetails 
        promptRun={selectedRun} 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onRatingChange={handleRatingChange}
        onFeedbackChange={handleFeedbackChange}
      />
    </div>
  );
};

export default PromptRunsTab;
