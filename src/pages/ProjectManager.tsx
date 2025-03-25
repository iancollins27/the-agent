
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ProjectManagerNav from "../components/ProjectManagerNav";
import PromptRunsTable from '../components/admin/PromptRunsTable';
import PromptRunDetails from '../components/admin/PromptRunDetails';
import { PromptRun } from '../components/admin/types';
import { useAuth } from "@/hooks/useAuth";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";

const ProjectManager: React.FC = () => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [onlyShowMyProjects, setOnlyShowMyProjects] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user profile data
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
          setLoading(false); // Move this here to ensure it only gets set after profile is fetched
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setLoading(false); // Also set loading to false in case of error
      }
    };
    
    fetchUserProfile();
  }, [user]);

  // Fetch prompt runs based on user profile, status filter, and project filter
  useEffect(() => {
    if (userProfile) {
      fetchPromptRuns();
    }
  }, [statusFilter, userProfile, onlyShowMyProjects]);

  const fetchPromptRuns = async () => {
    if (!user) {
      // If no user is logged in, show no data
      setPromptRuns([]);
      setLoading(false);
      return;
    }

    // Only proceed if we have the user profile with profile_associated_company
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
      // Build the query to find projects
      let projectQuery = supabase
        .from('projects')
        .select('id')
        .eq('company_id', userProfile.profile_associated_company) // Use profile_associated_company instead of company_id
        .neq('Project_status', 'archived'); // Filter out archived projects
      
      // Apply filter to only show projects where user is project manager if that filter is selected
      if (onlyShowMyProjects) {
        projectQuery = projectQuery.eq('project_manager', userProfile.id);
      }

      const { data: projectsData, error: projectsError } = await projectQuery;

      if (projectsError) {
        throw projectsError;
      }

      if (!projectsData || projectsData.length === 0) {
        // No projects found with the current filters
        setPromptRuns([]);
        setLoading(false);
        return;
      }

      // Get the project IDs
      const projectIds = projectsData.map(project => project.id);

      // Now fetch prompt runs for these projects
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

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const formattedData = data.map(run => {
        // Construct the CRM URL by combining the base URL with the project's CRM ID
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

      if (selectedRun && selectedRun.id === promptRunId) {
        setSelectedRun(prev => prev ? { ...prev, feedback_rating: rating } : null);
      }

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

      if (selectedRun && selectedRun.id === promptRunId) {
        setSelectedRun(prev => prev 
          ? { 
              ...prev, 
              feedback_description: feedback.description || null, 
              feedback_tags: feedback.tags || null 
            } 
          : null
        );
      }

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

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <ProjectManagerNav />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Project Manager Dashboard</h2>
          <div className="flex space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuCheckboxItem
                  checked={onlyShowMyProjects}
                  onCheckedChange={setOnlyShowMyProjects}
                >
                  Only My Projects
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Select 
              value={statusFilter || "all"} 
              onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchPromptRuns}>Refresh</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : promptRuns.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {user ? 
                  "No prompt runs found with the current filters" : 
                  "Please log in to view your project data"}
              </p>
            </CardContent>
          </Card>
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
