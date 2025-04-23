
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

const PromptRunsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("not-reviewed");
  const { toast } = useToast();

  // Use React Query to handle data fetching and error handling
  const {
    data: promptRuns = [],
    isLoading: loading,
    refetch: fetchPromptRuns,
    error
  } = useQuery({
    queryKey: ['promptRuns', statusFilter],
    queryFn: async () => {
      try {
        // First, get prompt runs data
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
          `);
            
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }
        
        const { data: runsData, error: runsError } = await query
          .order('created_at', { ascending: false });
          
        if (runsError) throw runsError;
        
        // Now separately fetch pending action counts for each prompt run
        const promptRunIds = runsData.map((run: any) => run.id);
        
        const { data: actionsData, error: actionsError } = await supabase
          .from('action_records')
          .select('prompt_run_id, count')
          .in('prompt_run_id', promptRunIds)
          .eq('status', 'pending')
          .throwOnError();

        if (actionsError) throw actionsError;
        
        // Create a map of prompt run IDs to pending action counts
        const pendingActionCounts = new Map();
        actionsData?.forEach((action: any) => {
          const runId = action.prompt_run_id;
          const count = pendingActionCounts.get(runId) || 0;
          pendingActionCounts.set(runId, count + 1);
        });
        
        // Format data to include project information
        return runsData.map((run: any) => ({
          ...run,
          project_name: run.projects?.crm_id || 'Unknown Project',
          project_address: run.projects?.Address || null,
          workflow_prompt_type: 'Unknown Type', // Not fetched in this query
          pending_actions: pendingActionCounts.get(run.id) || 0
        })) as PromptRun[];
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
      if (promptRuns) {
        const updatedRuns = updater(promptRuns);
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
    if (!promptRuns) return [];
    
    if (reviewFilter === "all") return promptRuns;
    if (reviewFilter === "reviewed") return promptRuns.filter(run => run.reviewed);
    if (reviewFilter === "not-reviewed") return promptRuns.filter(run => !run.reviewed);
    
    return promptRuns;
  }, [promptRuns, reviewFilter]);

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
        <PromptRunsTable 
          promptRuns={filteredPromptRuns} 
          onRatingChange={handleRatingChange} 
          onViewDetails={viewPromptRunDetails} 
          onRunReviewed={handleRunReviewed}
          reviewFilter={reviewFilter}
        />
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
