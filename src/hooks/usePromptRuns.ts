
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PromptRun } from '../components/admin/types';
import { TIME_FILTERS } from "../components/admin/TimeFilterSelect";

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
      console.log("Fetching prompt runs with company ID:", userProfile.profile_associated_company);
      
      const { data: allProjects, error: allProjectsError } = await supabase
        .from('projects')
        .select('id, crm_id, Address')
        .eq('company_id', userProfile.profile_associated_company);
      
      if (allProjectsError) {
        console.error("Error fetching all projects:", allProjectsError);
      } else {
        console.log("All projects for company:", allProjects);
      }
      
      let projectQuery = supabase
        .from('projects')
        .select('id')
        .eq('company_id', userProfile.profile_associated_company);

      if (onlyShowMyProjects) {
        projectQuery = projectQuery.eq('project_manager', userProfile.id);
      }

      const { data: projectsData, error: projectsError } = await projectQuery;

      if (projectsError) {
        throw projectsError;
      }

      console.log("Projects found:", projectsData?.length || 0);
      
      if (!projectsData || projectsData.length === 0) {
        setPromptRuns([]);
        setLoading(false);
        return;
      }

      const projectIds = projectsData.map(project => project.id);
      console.log("Project IDs:", projectIds);

      const { data: allPromptRuns, error: allPromptRunsError } = await supabase
        .from('prompt_runs')
        .select('id, project_id, status, created_at')
        .order('created_at', { ascending: false });
      
      if (allPromptRunsError) {
        console.error("Error fetching all prompt runs:", allPromptRunsError);
      } else {
        console.log("All available prompt runs:", allPromptRuns);
      }

      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (
            id,
            crm_id, 
            Address,
            company_id,
            companies:company_id (
              company_project_base_URL
            )
          ),
          workflow_prompts:workflow_prompt_id (type)
        `)
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (timeFilter !== TIME_FILTERS.ALL) {
        const timeConstraint = getDateFilter();
        if (timeConstraint) {
          query = query.gte('created_at', timeConstraint);
        }
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      console.log("Prompt runs found:", data?.length || 0);

      const formattedData = data.map(run => {
        const baseUrl = run.projects?.companies?.company_project_base_URL || null;
        const crmId = run.projects?.crm_id || null;
        const crmUrl = baseUrl && crmId ? `${baseUrl}${crmId}` : null;
        
        return {
          ...run,
          project_name: run.projects?.crm_id || 'Unknown Project',
          project_address: run.projects?.Address || null,
          project_crm_url: crmUrl,
          workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
          workflow_type: run.workflow_prompts?.type,
          prompt_text: run.prompt_input,
          result: run.prompt_output
        } as unknown as PromptRun;
      });

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

  const handleRatingChange = async (promptRunId: string, rating: number | null) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ feedback_rating: rating })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      setPromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId ? { ...run, feedback_rating: rating } : run
        )
      );

      toast({
        title: rating ? "Rating Updated" : "Rating Cleared",
        description: rating 
          ? "Prompt run rating has been updated successfully" 
          : "Prompt run rating has been cleared",
      });
    } catch (error) {
      console.error('Error updating rating:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update rating",
      });
    }
  };

  const handleFeedbackChange = async (promptRunId: string, feedback: { description?: string; tags?: string[] }) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({
          feedback_description: feedback.description,
          feedback_tags: feedback.tags
        })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      setPromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId 
            ? { 
                ...run, 
                feedback_description: feedback.description || null, 
                feedback_tags: feedback.tags || null 
              } 
            : run
        )
      );

      toast({
        title: "Feedback Updated",
        description: "Prompt run feedback has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update feedback",
      });
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
