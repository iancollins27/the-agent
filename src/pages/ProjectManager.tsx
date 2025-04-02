
import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunDetails from '../components/admin/PromptRunDetails';
import { PromptRun } from '../components/admin/types';
import { useAuth } from "@/hooks/useAuth";
import { useTimeFilter, TIME_FILTERS } from "@/hooks/useTimeFilter";
import { usePromptRuns } from '@/hooks/usePromptRuns';

// Import new components
import ProjectManagerHeader from '../components/project-manager/ProjectManagerHeader';
import ProjectManagerFilters from '../components/project-manager/ProjectManagerFilters';
import ProjectManagerContent from '../components/project-manager/ProjectManagerContent';

const ProjectManager: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [onlyMyProjects, setOnlyMyProjects] = useState(false);
  const [projectManagerFilter, setProjectManagerFilter] = useState<string | null>(null);
  const [hideReviewed, setHideReviewed] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  // Explicitly set the default to ALL to ensure it's used
  const { timeFilter, setTimeFilter, getDateFilter } = useTimeFilter(TIME_FILTERS.ALL);

  // Fetch user profile when component mounts
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) {
          console.error('Error fetching user profile:', error);
        } else {
          console.log('User profile loaded:', data);
          setUserProfile(data);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user]);

  // Reset project manager filter when "only my projects" is checked
  useEffect(() => {
    if (onlyMyProjects) {
      setProjectManagerFilter(null);
    }
  }, [onlyMyProjects]);

  // Reset "only my projects" when project manager filter is set
  useEffect(() => {
    if (projectManagerFilter) {
      setOnlyMyProjects(false);
    }
  }, [projectManagerFilter]);

  // Use the custom hook to fetch prompt runs, only showing the latest run for each project
  const { 
    promptRuns, 
    loading, 
    handleRatingChange, 
    handleFeedbackChange, 
    fetchPromptRuns,
    setPromptRuns
  } = usePromptRuns({
    userProfile,
    statusFilter,
    onlyShowMyProjects: onlyMyProjects,
    projectManagerFilter,
    timeFilter,
    getDateFilter,
    onlyShowLatestRuns: true // Explicitly set to true to ensure the latest runs filter is applied
  });

  console.log(`ProjectManager component: Retrieved ${promptRuns.length} prompt runs`);
  console.log(`Using latest runs filter: true`);

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handleRunReviewed = (promptRunId: string) => {
    // Update the local state to mark the run as reviewed
    setPromptRuns(prev => 
      prev.map(run => 
        run.id === promptRunId ? { ...run, reviewed: true } : run
      )
    );
  };

  const getEmptyStateMessage = () => {
    if (!user) {
      return "Please log in to view your project data";
    }
    
    if (!userProfile?.profile_associated_company) {
      return "Your user profile is not associated with a company. Contact your administrator.";
    }
    
    if (onlyMyProjects) {
      return "No prompt runs found for your projects. Try unchecking 'Only My Projects' filter.";
    }
    
    if (projectManagerFilter) {
      return "No prompt runs found for the selected project manager's projects.";
    }
    
    if (statusFilter) {
      return `No prompt runs found with the '${statusFilter}' status. Try selecting a different status.`;
    }
    
    if (timeFilter !== TIME_FILTERS.ALL) {
      return `No prompt runs found within the selected time range. Try selecting a different time range.`;
    }
    
    return "No prompt runs found for your company's projects. This could be because:\n1. No prompt runs have been created yet\n2. You don't have access to the projects with prompt runs";
  };

  // Force a refresh on component mount to ensure latest data
  useEffect(() => {
    if (userProfile) {
      console.log("Forcing a data refresh on component mount");
      fetchPromptRuns();
    }
  }, [userProfile]);

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <ProjectManagerHeader title="Project Manager Dashboard" />
          <ProjectManagerFilters 
            hideReviewed={hideReviewed}
            setHideReviewed={setHideReviewed}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onlyMyProjects={onlyMyProjects}
            setOnlyMyProjects={setOnlyMyProjects}
            projectManagerFilter={projectManagerFilter}
            setProjectManagerFilter={setProjectManagerFilter}
            onRefresh={fetchPromptRuns}
          />
        </div>

        <ProjectManagerContent 
          loading={loading}
          promptRuns={promptRuns}
          hideReviewed={hideReviewed}
          getEmptyStateMessage={getEmptyStateMessage}
          debugInfo={{
            userId: user?.id,
            companyId: userProfile?.profile_associated_company,
            statusFilter,
            onlyMyProjects,
            projectManagerFilter,
            timeFilter
          }}
          onViewDetails={viewPromptRunDetails}
          onRatingChange={handleRatingChange}
          onRunReviewed={handleRunReviewed}
        />

        <PromptRunDetails 
          promptRun={selectedRun} 
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onRatingChange={handleRatingChange}
          onFeedbackChange={handleFeedbackChange}
        />
      </div>
    </div>
  );
};

export default ProjectManager;
