
import { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../components/admin/types';
import { TIME_FILTERS } from "../components/admin/TimeFilterSelect";
import { usePromptFeedback } from './usePromptFeedback';
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
  timeFilter: string;
  getDateFilter: () => string | null;
}

export const usePromptRuns = ({
  userProfile,
  statusFilter,
  onlyShowMyProjects,
  timeFilter,
  getDateFilter
}: UsePromptRunsProps) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { handleRatingChange, handleFeedbackChange } = usePromptFeedback(setPromptRuns);

  useEffect(() => {
    if (userProfile) {
      fetchPromptRuns();
    }
  }, [statusFilter, userProfile, onlyShowMyProjects, timeFilter]);

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
        onlyShowMyProjects
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
      const formattedData = formatPromptRunData(data);

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
    loading,
    handleRatingChange,
    handleFeedbackChange,
    fetchPromptRuns
  };
};
