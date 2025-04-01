
import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunsTable from '../components/admin/PromptRunsTable';
import PromptRunDetails from '../components/admin/PromptRunDetails';
import { PromptRun } from '../components/admin/types';
import { useAuth } from "@/hooks/useAuth";
import { useTimeFilter, TIME_FILTERS } from "@/hooks/useTimeFilter";
import PromptRunFilters from '../components/admin/PromptRunFilters';
import EmptyPromptRuns from '../components/admin/EmptyPromptRuns';
import { usePromptRuns } from '@/hooks/usePromptRuns';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
    onlyShowLatestRuns: true // Only show the latest run for each project
  });

  console.log(`ProjectManager component: Retrieved ${promptRuns.length} prompt runs`);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <h2 className="text-2xl font-bold">Project Manager Dashboard</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="hide-reviewed"
                checked={hideReviewed}
                onCheckedChange={setHideReviewed}
              />
              <Label htmlFor="hide-reviewed">Hide Reviewed</Label>
            </div>
            <PromptRunFilters
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onlyShowMyProjects={onlyMyProjects}
              onMyProjectsChange={setOnlyMyProjects}
              projectManagerFilter={projectManagerFilter}
              onProjectManagerFilterChange={setProjectManagerFilter}
              onRefresh={fetchPromptRuns}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : promptRuns.length === 0 ? (
          <EmptyPromptRuns
            message={getEmptyStateMessage()}
            debugInfo={{
              userId: user?.id,
              companyId: userProfile?.profile_associated_company,
              statusFilter,
              onlyMyProjects,
              projectManagerFilter,
              timeFilter
            }}
          />
        ) : (
          <PromptRunsTable 
            promptRuns={promptRuns} 
            onRatingChange={handleRatingChange} 
            onViewDetails={viewPromptRunDetails}
            onRunReviewed={handleRunReviewed}
            hideReviewed={hideReviewed}
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
    </div>
  );
};

export default ProjectManager;
