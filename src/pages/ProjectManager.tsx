
import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunsTable from '../components/admin/PromptRunsTable';
import GroupedPromptRunsTable from '../components/admin/GroupedPromptRunsTable';
import PromptRunDetails from '../components/admin/PromptRunDetails';
import { PromptRun } from '../components/admin/types';
import { useAuth } from "@/hooks/useAuth";
import { useTimeFilter, TIME_FILTERS } from "@/hooks/useTimeFilter";
import PromptRunFilters from '../components/admin/PromptRunFilters';
import EmptyPromptRuns from '../components/admin/EmptyPromptRuns';
import { usePromptRuns } from '@/hooks/usePromptRuns';

const ProjectManager: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [onlyMyProjects, setOnlyMyProjects] = useState(false);
  const [groupByProject, setGroupByProject] = useState(true);
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
          setUserProfile(data);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };
    
    fetchUserProfile();
  }, [user]);

  // Use the custom hook to fetch prompt runs
  const { 
    promptRuns, 
    groupedPromptRuns,
    loading, 
    handleRatingChange, 
    handleFeedbackChange, 
    fetchPromptRuns 
  } = usePromptRuns({
    userProfile,
    statusFilter,
    onlyShowMyProjects: onlyMyProjects,
    timeFilter,
    getDateFilter
  });

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
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
    
    if (statusFilter) {
      return `No prompt runs found with the '${statusFilter}' status. Try selecting a different status.`;
    }
    
    if (timeFilter !== TIME_FILTERS.ALL) {
      return `No prompt runs found within the selected time range. Try selecting a different time range.`;
    }
    
    return "No prompt runs found for your company's projects. This could be because:\n1. No prompt runs have been created yet\n2. You don't have access to the projects with prompt runs";
  };

  const toggleGroupByProject = () => {
    setGroupByProject(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Project Manager Dashboard</h2>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={toggleGroupByProject}
              className="text-xs"
            >
              {groupByProject ? "View Flat List" : "Group by Project"}
            </Button>
            <PromptRunFilters
              timeFilter={timeFilter}
              onTimeFilterChange={setTimeFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              onlyShowMyProjects={onlyMyProjects}
              onMyProjectsChange={setOnlyMyProjects}
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
              timeFilter
            }}
          />
        ) : groupByProject ? (
          <GroupedPromptRunsTable 
            groupedPromptRuns={groupedPromptRuns} 
            onRatingChange={handleRatingChange} 
            onViewDetails={viewPromptRunDetails} 
          />
        ) : (
          <PromptRunsTable 
            promptRuns={promptRuns} 
            onRatingChange={handleRatingChange} 
            onViewDetails={viewPromptRunDetails} 
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
