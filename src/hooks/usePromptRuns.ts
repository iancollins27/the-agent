
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../components/admin/types';
import { TIME_FILTERS } from "./useTimeFilter";
import { usePromptFeedback } from './usePromptFeedback';
import { supabase } from "@/integrations/supabase/client";
import { 
  debugProjectData, 
  fetchProjects, 
  fetchFilteredPromptRuns, 
  formatPromptRunData 
} from '@/utils/promptRunsApi';

interface UsePromptRunsProps {
  userProfile: any;
  statusFilter: string | null;
  onlyShowMyProjects: boolean;
  projectManagerFilter: string | null;
  timeFilter: string;
  getDateFilter: () => string | null;
  onlyShowLatestRuns?: boolean;
}

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  projectManagerFilter,
  timeFilter,
  getDateFilter,
  onlyShowLatestRuns = false
}: UsePromptRunsProps) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback(setPromptRuns);

  useEffect(() => {
    if (userProfile) {
      fetchPromptRuns();
    }
  }, [statusFilter, userProfile, onlyShowMyProjects, projectManagerFilter, timeFilter, onlyShowLatestRuns]);

  const fetchPromptRuns = async () => {
    if (!userProfile?.profile_associated_company) {
      console.warn('User has no profile_associated_company in profile, cannot fetch projects');
      setPromptRuns([]);
      setLoading(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Your user profile is not associated with a company",
      });
      return;
    }

    setLoading(true);
    try {
      const companyId = userProfile.profile_associated_company;
      
      // Debug logging to help troubleshoot data issues
      await debugProjectData(companyId);
      
      // Fetch projects based on filters
      const projectsData = await fetchProjects(
        companyId, 
        userProfile.id, 
        onlyShowMyProjects,
        projectManagerFilter
      );
      
      if (projectsData.length === 0) {
        setPromptRuns([]);
        setLoading(false);
        return;
      }

      const projectIds = projectsData.map(project => project.id);
      
      // Get time constraint from filter
      const timeConstraint = timeFilter !== TIME_FILTERS.ALL ? getDateFilter() : null;
      
      // Fetch prompt runs with filters
      const data = await fetchFilteredPromptRuns(projectIds, statusFilter, timeConstraint);
      
      // Format the data for display
      let formattedData = formatPromptRunData(data);

      console.log(`Total prompt runs before filtering: ${formattedData.length}`);
      console.log(`onlyShowLatestRuns is set to: ${onlyShowLatestRuns}`);

      // If onlyShowLatestRuns is true, filter to keep only the latest run for each project
      if (onlyShowLatestRuns === true && formattedData.length > 0) {
        console.log("Filtering to show only latest runs per project");
        
        // Create a map to store the latest prompt run for each project
        const latestRunsByProject = new Map<string, PromptRun>();
        
        // Iterate through all prompt runs to find the latest for each project
        formattedData.forEach(run => {
          if (!run.project_id) {
            console.log(`Skipping run ${run.id} with no project_id`);
            return; // Skip runs without a project ID
          }
          
          const existingRun = latestRunsByProject.get(run.project_id);
          
          // If we don't have a run for this project yet, or if this run is more recent than what we have
          if (!existingRun || new Date(run.created_at) > new Date(existingRun.created_at)) {
            latestRunsByProject.set(run.project_id, run);
          }
        });
        
        // Convert the map values back to an array
        formattedData = Array.from(latestRunsByProject.values());
        
        // Sort by created_at in descending order (most recent first)
        formattedData.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        console.log(`Total prompt runs after filtering for latest only: ${formattedData.length}`);
      } else {
        console.log(`Skipping latest runs filter, showing all ${formattedData.length} runs`);
      }

      setPromptRuns(formattedData);
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    promptRuns,
    setPromptRuns,
    loading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  };
};
