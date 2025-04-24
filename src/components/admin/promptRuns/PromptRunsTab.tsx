
import React, { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { useTimeFilter } from '@/hooks/useTimeFilter';
import { useToast } from "@/components/ui/use-toast";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import PromptRunsTable from '../PromptRunsTable';
import PromptRunFilters from '../PromptRunFilters';
import EmptyPromptRunsState from './EmptyPromptRunsState';
import { Button } from '@/components/ui/button';
import { usePagination } from '@/hooks/usePagination';
import { usePromptFeedback } from '@/hooks/usePromptFeedback';
import { PromptRun } from '../types';

const PromptRunsTab: React.FC = () => {
  const { user, loading: profileLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [onlyShowMyProjects, setOnlyShowMyProjects] = useState(false);
  const [projectManagerFilter, setProjectManagerFilter] = useState<string | null>(null);
  const [excludeReminders, setExcludeReminders] = useState(false);
  const [onlyShowLatest, setOnlyShowLatest] = useState(false);
  const { timeFilter, setTimeFilter, getDateFilter } = useTimeFilter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { page, pageSize, setPage, setPageSize } = usePagination(1, 20);
  const { toast } = useToast();
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback(setPromptRuns);
  const [totalCount, setTotalCount] = useState(0);
  
  const fetchPromptRuns = async () => {
    if (!user) {
      console.warn('User is not authenticated, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setIsRefreshing(true);
    
    try {
      // Get user profile to access company ID
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('profile_associated_company')
        .eq('id', user.id)
        .single();
        
      if (profileError || !profileData?.profile_associated_company) {
        console.error('Error fetching user profile or no company associated:', profileError);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Unable to fetch your company information",
        });
        return;
      }
      
      const companyId = profileData.profile_associated_company;
      
      // Fetch projects for the company
      let projectsQuery = supabase
        .from('projects')
        .select('id')
        .eq('company_id', companyId);
      
      if (onlyShowMyProjects) {
        projectsQuery = projectsQuery.eq('project_manager', user.id);
      } else if (projectManagerFilter) {
        projectsQuery = projectsQuery.eq('project_manager', projectManagerFilter);
      }
      
      const { data: projectsData, error: projectsError } = await projectsQuery;
      
      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
        throw projectsError;
      }
      
      if (!projectsData || projectsData.length === 0) {
        setPromptRuns([]);
        setTotalCount(0);
        return;
      }
      
      const projectIds = projectsData.map(project => project.id);
      
      // Get total count for pagination
      let countQuery = supabase
        .from('prompt_runs')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds);
        
      if (statusFilter) {
        countQuery = countQuery.eq('status', statusFilter);
      }
      
      const timeConstraint = timeFilter !== 'all' ? getDateFilter() : null;
      if (timeConstraint) {
        countQuery = countQuery.gte('created_at', timeConstraint);
      }
      
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error fetching count:', countError);
      } else {
        setTotalCount(count || 0);
      }
      
      // Fetch prompt runs with pagination
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (
            Address,
            project_manager,
            next_step,
            profiles:project_manager (
              profile_fname,
              profile_lname
            )
          ),
          workflow_prompts:workflow_prompt_id (
            type
          )
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
        
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }
      
      if (timeConstraint) {
        query = query.gte('created_at', timeConstraint);
      }
      
      const { data: runsData, error: runsError } = await query;
      
      if (runsError) {
        console.error('Error fetching prompt runs:', runsError);
        throw runsError;
      }
      
      // Format the data
      let formattedRuns = (runsData || []).map(run => ({
        id: run.id,
        project_id: run.project_id,
        created_at: run.created_at,
        completed_at: run.completed_at,
        status: run.status,
        ai_provider: run.ai_provider,
        ai_model: run.ai_model,
        workflow_type: run.workflow_prompts?.type,
        feedback_rating: run.feedback_rating,
        feedback_description: run.feedback_description,
        feedback_tags: run.feedback_tags,
        project_address: run.projects?.Address || 'Unknown Address',
        project_next_step: run.projects?.next_step,
        project_manager: run.projects?.project_manager || null,
        pm_name: run.projects?.profiles 
          ? `${run.projects.profiles.profile_fname || ''} ${run.projects.profiles.profile_lname || ''}`.trim() 
          : 'Unknown',
        prompt_input: run.prompt_input,
        prompt_output: run.prompt_output,
        reviewed: run.reviewed || false,
        pending_actions: 0 // Will be populated in the next step
      })) as PromptRun[];

      if (onlyShowLatest && formattedRuns.length > 0) {
        const latestRunsByProject = new Map<string, PromptRun>();
        
        formattedRuns.forEach(run => {
          if (!run.project_id) return;
          
          const existingRun = latestRunsByProject.get(run.project_id);
          
          if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
            latestRunsByProject.set(run.project_id, run);
          }
        });
        
        formattedRuns = Array.from(latestRunsByProject.values());
        formattedRuns.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      // Get pending actions count
      if (formattedRuns.length > 0) {
        const promptRunIds = formattedRuns.map(run => run.id);
        
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id')
          .eq('status', 'pending')
          .in('prompt_run_id', promptRunIds);
          
        if (!actionError && actionData) {
          // Count occurrences of each prompt_run_id
          const pendingActionCounts = new Map<string, number>();
          
          actionData.forEach(action => {
            const currentCount = pendingActionCounts.get(action.prompt_run_id) || 0;
            pendingActionCounts.set(action.prompt_run_id, currentCount + 1);
          });
          
          formattedRuns = formattedRuns.map(run => ({
            ...run,
            pending_actions: pendingActionCounts.get(run.id) || 0
          }));
        }
      }

      // Filter to exclude reminder actions if requested
      if (excludeReminders && formattedRuns.length > 0) {
        const promptRunIds = formattedRuns.map(run => run.id);
        
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id, action_type')
          .in('prompt_run_id', promptRunIds);

        if (actionError) {
          console.error('Error fetching action records:', actionError);
        } else if (actionData) {
          const filteredActionRunIds = new Set(
            actionData
              .filter(action => 
                action.action_type === 'set_future_reminder' || 
                action.action_type === 'NO_ACTION'
              )
              .map(action => action.prompt_run_id)
          );

          formattedRuns = formattedRuns.filter(
            run => !filteredActionRunIds.has(run.id)
          );
        }
      }

      setPromptRuns(formattedRuns);
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch data initially and when filters change
  useEffect(() => {
    fetchPromptRuns();
  }, [
    user,
    statusFilter, 
    onlyShowMyProjects, 
    projectManagerFilter, 
    timeFilter, 
    onlyShowLatest,
    excludeReminders,
    page,
    pageSize
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prompt Runs</h2>
        <Button 
          onClick={fetchPromptRuns} 
          variant="outline" 
          size="sm"
          disabled={isRefreshing || loading}
        >
          Refresh
        </Button>
      </div>
      
      <PromptRunFilters
        timeFilter={timeFilter}
        setTimeFilter={setTimeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onlyShowMyProjects={onlyShowMyProjects}
        setOnlyShowMyProjects={setOnlyShowMyProjects}
        projectManagerFilter={projectManagerFilter}
        setProjectManagerFilter={setProjectManagerFilter}
        excludeReminders={excludeReminders}
        setExcludeReminders={setExcludeReminders}
        onlyShowLatest={onlyShowLatest}
        setOnlyShowLatest={setOnlyShowLatest}
        refreshData={fetchPromptRuns}
        isRefreshing={isRefreshing}
      />
      
      <Card className="p-5">
        {promptRuns.length > 0 ? (
          <>
            <PromptRunsTable 
              promptRuns={promptRuns}
              loading={loading || profileLoading}
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
          <EmptyPromptRunsState loading={loading || profileLoading} />
        )}
      </Card>
    </div>
  );
};

export default PromptRunsTab;
