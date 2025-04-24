
import React, { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { useTimeFilter } from '@/hooks/useTimeFilter';
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import PromptRunsTable from '../PromptRunsTable';
import PromptRunFilters from '../PromptRunFilters';
import EmptyPromptRuns from '../EmptyPromptRuns';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { usePromptRuns } from '@/hooks/usePromptRuns';
import { usePagination } from '@/hooks/usePagination';

const PromptRunsTab: React.FC = () => {
  const { userProfile, loading: profileLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [onlyShowMyProjects, setOnlyShowMyProjects] = useState(false);
  const [projectManagerFilter, setProjectManagerFilter] = useState<string | null>(null);
  const [excludeReminders, setExcludeReminders] = useState(false);
  const [onlyShowLatest, setOnlyShowLatest] = useState(false);
  const { timeFilter, setTimeFilter, getDateFilter } = useTimeFilter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { page, pageSize, setPage, setPageSize } = usePagination(1, 20);
  const { toast } = useToast();

  // Use the custom hook to fetch and manage prompt runs
  const {
    promptRuns,
    loading: promptRunsLoading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  } = usePromptRuns({
    userProfile,
    statusFilter,
    onlyShowMyProjects,
    projectManagerFilter,
    timeFilter,
    getDateFilter,
    onlyShowLatestRuns: onlyShowLatest,
    excludeReminderActions: excludeReminders,
    page,
    pageSize
  });

  const refreshData = async () => {
    setIsRefreshing(true);
    await fetchPromptRuns();
    setIsRefreshing(false);
  };

  const fetchActionCount = async () => {
    try {
      // Instead of using a custom function, query the action_records table directly
      const { data, error } = await supabase
        .from('action_records')
        .select('prompt_run_id, count')
        .eq('status', 'pending')
        .in('prompt_run_id', promptRuns.map(run => run.id));
        
      if (error) throw error;
      
      // Create a map of prompt_run_id to count
      const countMap = {};
      if (data && Array.isArray(data)) {
        data.forEach(item => {
          // Count occurrences of each prompt_run_id
          countMap[item.prompt_run_id] = (countMap[item.prompt_run_id] || 0) + 1;
        });
      }
      
      // Update the promptRuns with the pending_actions count
      const updatedRuns = promptRuns.map(run => ({
        ...run,
        pending_actions: countMap[run.id] || 0
      }));
      
      return updatedRuns;
    } catch (error) {
      console.error('Error fetching action counts:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to fetch action counts: ${error.message}`,
      });
      return promptRuns;
    }
  };

  // Fetch total count of prompt runs for pagination
  const [totalCount, setTotalCount] = useState(0);
  
  useEffect(() => {
    const fetchTotalCount = async () => {
      if (!userProfile?.profile_associated_company) return;
      
      try {
        const { count, error } = await supabase
          .from('prompt_runs')
          .select('*', { count: 'exact', head: true })
          // Add the same filters as in usePromptRuns
          .eq(statusFilter ? 'status' : 'id', statusFilter || 'id');
          
        if (error) throw error;
        setTotalCount(count || 0);
      } catch (error) {
        console.error('Error fetching total count:', error);
      }
    };
    
    fetchTotalCount();
  }, [userProfile, statusFilter, timeFilter, onlyShowMyProjects, projectManagerFilter]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prompt Runs</h2>
        <Button 
          onClick={refreshData} 
          variant="outline" 
          size="sm"
          disabled={isRefreshing || promptRunsLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      <PromptRunFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onlyShowMyProjects={onlyShowMyProjects}
        setOnlyShowMyProjects={setOnlyShowMyProjects}
        projectManagerFilter={projectManagerFilter}
        setProjectManagerFilter={setProjectManagerFilter}
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        excludeReminders={excludeReminders}
        setExcludeReminders={setExcludeReminders}
        onlyShowLatest={onlyShowLatest}
        setOnlyShowLatest={setOnlyShowLatest}
      />
      
      <Card className="p-5">
        {promptRuns.length > 0 ? (
          <>
            <PromptRunsTable 
              promptRuns={promptRuns}
              loading={promptRunsLoading || profileLoading}
              onRatingChange={handleRatingChange}
              onFeedbackChange={handleFeedbackChange}
            />
            
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {promptRuns.length} of {totalCount} prompt runs
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                
                <div className="text-sm">
                  Page {page} of {totalPages || 1}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyPromptRuns loading={promptRunsLoading || profileLoading} />
        )}
      </Card>
    </div>
  );
};

export default PromptRunsTab;
