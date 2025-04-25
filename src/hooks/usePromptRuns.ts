
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '@/components/admin/types';
import { fetchFilteredPromptRuns } from '@/services/promptRunsService';
import { useProjectData } from './useProjectData';
import { usePromptRunFormatting } from './usePromptRunFormatting';

interface UsePromptRunsProps {
  userProfile: any;
  statusFilter: string | null;
  onlyShowMyProjects: boolean;
  projectManagerFilter: string | null;
  timeFilter: string;
  getDateFilter: () => string | null;
  onlyShowLatestRuns?: boolean;
  excludeReminderActions?: boolean;
}

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false,
  excludeReminderActions = false
}: UsePromptRunsProps) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { formatPromptRunData } = usePromptRunFormatting();

  const projectsData = useProjectData(
    userProfile?.profile_associated_company,
    userProfile?.id,
    onlyShowMyProjects,
    projectManagerFilter
  );

  const fetchPromptRuns = async () => {
    if (!userProfile?.profile_associated_company) {
      console.warn('User has no profile_associated_company in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const projectIds = projectsData.map(project => project.id);
      const timeConstraint = timeFilter !== 'ALL' ? getDateFilter() : null;
      
      const data = await fetchFilteredPromptRuns(projectIds, statusFilter, timeConstraint);
      let formattedData = formatPromptRunData(data);

      if (onlyShowLatestRuns === true && formattedData.length > 0) {
        const latestRunsByProject = new Map<string, PromptRun>();
        formattedData.forEach(run => {
          if (!run.project_id) return;
          const existingRun = latestRunsByProject.get(run.project_id);
          if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
            latestRunsByProject.set(run.project_id, run);
          }
        });
        formattedData = Array.from(latestRunsByProject.values());
        formattedData.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      if (excludeReminderActions && formattedData.length > 0) {
        const promptRunIds = formattedData.map(run => run.id);
        
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('prompt_run_id, action_type')
          .in('prompt_run_id', promptRunIds);

        if (actionError) {
          console.error('Error fetching action records:', actionError);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to filter out reminder actions",
          });
        } else {
          const filteredActionRunIds = new Set(
            actionData
              .filter(action => 
                action.action_type === 'set_future_reminder' || 
                action.action_type === 'NO_ACTION'
              )
              .map(action => action.prompt_run_id)
          );

          formattedData = formattedData.filter(
            run => !filteredActionRunIds.has(run.id)
          );
        }
      }

      setPromptRuns(formattedData);
    } catch (error) {
      console.error('Error in fetchPromptRuns:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userProfile) {
      fetchPromptRuns();
    }
  }, [userProfile, statusFilter, onlyShowMyProjects, projectManagerFilter, timeFilter, projectsData]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    fetchPromptRuns
  };
};

