import React, { useState, useEffect } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import ProjectManagerLayout from "./ProjectManagerLayout";
import ProjectManagerToolbar from "./ProjectManagerToolbar";
import ProjectManagerDetailsPanel from "./ProjectManagerDetailsPanel";
import { PromptRun } from '../admin/types';
import { formatDistanceToNow } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import { Button } from "@/components/ui/button";
import { ReloadIcon } from "@radix-ui/react-icons";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area"
import MultiProjectMessage from './MultiProjectMessage';
import ActionRecipientDisplay from './ActionRecipientDisplay';
import MessageActionConfirmation from './MessageActionConfirmation';

// Define the type for filter values
export interface StoredFilterValues {
  hideReviewed: boolean;
  excludeReminderActions: boolean;
  timeFilter: string;
  statusFilter: string | null;
  onlyMyProjects: boolean;
  projectManagerFilter: string | null;
  groupByRoofer: boolean;
  sortRooferAlphabetically: boolean;
  onlyPendingActions: boolean;
}

const ProjectManagerDashboard: React.FC = () => {
  const { toast } = useToast();
  const { session } = useSession();
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [filters, setFilters] = useState<StoredFilterValues>({
    hideReviewed: false,
    excludeReminderActions: false,
    timeFilter: '7days',
    statusFilter: null,
    onlyMyProjects: false,
    projectManagerFilter: null,
    groupByRoofer: false,
    sortRooferAlphabetically: true,
    onlyPendingActions: false
  });

  // This function needs to have its type fixed
  const updateFilter = <K extends keyof StoredFilterValues>(key: K, value: StoredFilterValues[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const fetchPromptRuns = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('prompt_runs')
        .select(`
          id, 
          created_at, 
          project_id, 
          prompt_text, 
          result, 
          rating, 
          feedback,
          metadata,
          error,
          projects (
            Name, 
            Address,
            next_check_date,
            project_track,
            project_tracks (
              Name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Time filter
      const now = new Date();
      let startDate;
      switch (filters.timeFilter) {
        case '24hours':
          startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
          break;
        case '7days':
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
          break;
        case '30days':
          startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
          break;
        case '90days':
          startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
          break;
        case 'all':
          startDate = null;
          break;
        default:
          startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // Default to 7 days
      }

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      // Status filter
      if (filters.statusFilter) {
        query = query.eq('metadata->>status', filters.statusFilter);
      }

      // Hide reviewed
      if (filters.hideReviewed) {
        query = query.is('rating', null);
      }

      // Only my projects
      if (filters.onlyMyProjects && session?.user?.id) {
        query = query.eq('metadata->>project_manager_id', session.user.id);
      }

      // Project manager filter
      if (filters.projectManagerFilter) {
        query = query.eq('metadata->>project_manager_id', filters.projectManagerFilter);
      }
      
      // Only pending actions
      if (filters.onlyPendingActions) {
        query = query.not('project_id', 'is', null);
        
        const { data: actionData, error: actionError } = await supabase
          .from('action_records')
          .select('project_id')
          .eq('status', 'pending');
          
        if (actionError) {
          console.error('Error fetching action records:', actionError);
          throw new Error('Failed to check for pending actions');
        }
        
        if (actionData && actionData.length > 0) {
          const projectIdsWithPendingActions = actionData.map(action => action.project_id);
          query = query.in('project_id', projectIdsWithPendingActions);
        } else {
          // If no pending actions, return an empty result
          setPromptRuns([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching prompt runs:', error);
        throw error;
      }

      setPromptRuns(data || []);
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load data. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRun = (run: PromptRun) => {
    setSelectedRun(run);
    setDetailsOpen(true);
  };

  const handleRatingChange = async (promptRunId: string, rating: number | null) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ rating: rating })
        .eq('id', promptRunId);

      if (error) {
        console.error('Error updating rating:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update rating. Please try again."
        });
      } else {
        setPromptRuns(prev =>
          prev.map(run =>
            run.id === promptRunId ? { ...run, rating: rating } : run
          )
        );
        toast({
          title: "Success",
          description: "Rating updated successfully."
        });
      }
    } catch (error) {
      console.error('Error updating rating:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update rating. Please try again."
      });
    }
  };

  const handleFeedbackChange = async (promptRunId: string, feedback: { description?: string; tags?: string[] }) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ feedback: feedback })
        .eq('id', promptRunId);

      if (error) {
        console.error('Error updating feedback:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update feedback. Please try again."
        });
      } else {
        setPromptRuns(prev =>
          prev.map(run =>
            run.id === promptRunId ? { ...run, feedback: feedback } : run
          )
        );
        toast({
          title: "Success",
          description: "Feedback updated successfully."
        });
      }
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update feedback. Please try again."
      });
    }
  };

  const handlePromptRerun = async () => {
    if (!selectedRun) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select a prompt run to rerun."
      });
      return;
    }

    try {
      // Call the edge function to rerun the prompt
      const { data, error } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          promptType: 'action_detection_execution',
          promptText: selectedRun.prompt_text,
          projectId: selectedRun.project_id,
          contextData: selectedRun.metadata,
          aiProvider: 'openai',
          aiModel: 'gpt-4o',
          workflowPromptId: 'your_workflow_prompt_id', // Replace with actual ID
          initiatedBy: 'project-manager-dashboard'
        }
      });

      if (error) {
        console.error('Error invoking function:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to rerun prompt. Please try again."
        });
      } else {
        toast({
          title: "Prompt Rerun",
          description: "Prompt rerun initiated successfully."
        });
        fetchPromptRuns(); // Refresh the prompt runs
      }
    } catch (error) {
      console.error('Error rerunning prompt:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to rerun prompt. Please try again."
      });
    }
  };

  const filteredPromptRuns = promptRuns.filter(run => {
    if (!searchQuery) return true;
    const projectName = run.projects?.Name || '';
    const projectAddress = run.projects?.Address || '';
    return (
      projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      projectAddress.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const groupedPromptRuns = filters.groupByRoofer
    ? filteredPromptRuns.reduce((acc: { [key: string]: PromptRun[] }, run) => {
        const rooferName = run.projects?.Name || 'Unknown Roofer';
        if (!acc[rooferName]) {
          acc[rooferName] = [];
        }
        acc[rooferName].push(run);
        return acc;
      }, {})
    : null;

  const sortedRooferNames = filters.groupByRoofer && groupedPromptRuns
    ? Object.keys(groupedPromptRuns).sort((a, b) =>
        filters.sortRooferAlphabetically ? a.localeCompare(b) : 0
      )
    : [];

  return (
    <ProjectManagerLayout>
      <ProjectManagerToolbar
        hideReviewed={filters.hideReviewed}
        excludeReminderActions={filters.excludeReminderActions}
        timeFilter={filters.timeFilter}
        statusFilter={filters.statusFilter}
        onlyMyProjects={filters.onlyMyProjects}
        projectManagerFilter={filters.projectManagerFilter}
        groupByRoofer={filters.groupByRoofer}
        sortRooferAlphabetically={filters.sortRooferAlphabetically}
        onlyPendingActions={filters.onlyPendingActions}
        updateFilter={updateFilter}
        fetchPromptRuns={fetchPromptRuns}
      />

      {/* Main content with prompt runs display */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Label htmlFor="search">
            <Search className="mr-2 h-4 w-4" />
          </Label>
          <Input
            id="search"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center">
            <Button variant="ghost" disabled>
              <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </Button>
          </div>
        ) : (
          <>
            {filters.groupByRoofer && groupedPromptRuns ? (
              sortedRooferNames.map(rooferName => (
                <div key={rooferName} className="space-y-2">
                  <h2 className="text-lg font-semibold">{rooferName}</h2>
                  <MultiProjectMessage rooferName={rooferName} projects={groupedPromptRuns[rooferName]} />
                  <ScrollArea className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Created At</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Summary</TableHead>
                          <TableHead>Next Check</TableHead>
                          <TableHead>Actions</TableHead>
                          <TableHead className="text-right">Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedPromptRuns[rooferName].map(run => (
                          <TableRow key={run.id} onClick={() => handleSelectRun(run)} className="cursor-pointer hover:bg-muted">
                            <TableCell className="font-medium">{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</TableCell>
                            <TableCell>{run.projects?.Name}</TableCell>
                            <TableCell>{run.projects?.Address}</TableCell>
                            <TableCell>{run.summary?.substring(0, 50)}...</TableCell>
                            <TableCell>
                              {run.projects?.next_check_date ? formatDistanceToNow(new Date(run.projects.next_check_date), { addSuffix: true }) : 'No check scheduled'}
                            </TableCell>
                            <TableCell>
                              <ActionRecipientDisplay action={{
                                action_type: 'message',
                                recipient_id: 'some_recipient_id',
                                action_payload: {
                                  recipient: 'Homeowner'
                                }
                              }} />
                            </TableCell>
                            <TableCell className="text-right">
                              {run.rating !== null ? (
                                <Badge>{run.rating}</Badge>
                              ) : (
                                <Badge variant="secondary">Unrated</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ))
            ) : (
              <ScrollArea className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Created At</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Next Check</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead className="text-right">Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPromptRuns.map(run => (
                      <TableRow key={run.id} onClick={() => handleSelectRun(run)} className="cursor-pointer hover:bg-muted">
                        <TableCell className="font-medium">{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</TableCell>
                        <TableCell>{run.projects?.Name}</TableCell>
                        <TableCell>{run.projects?.Address}</TableCell>
                        <TableCell>{run.summary?.substring(0, 50)}...</TableCell>
                        <TableCell>
                          {run.projects?.next_check_date ? formatDistanceToNow(new Date(run.projects.next_check_date), { addSuffix: true }) : 'No check scheduled'}
                        </TableCell>
                        <TableCell>
                          <ActionRecipientDisplay action={{
                            action_type: 'message',
                            recipient_id: 'some_recipient_id',
                            action_payload: {
                              recipient: 'Homeowner'
                            }
                          }} />
                        </TableCell>
                        <TableCell className="text-right">
                          {run.rating !== null ? (
                            <Badge>{run.rating}</Badge>
                          ) : (
                            <Badge variant="secondary">Unrated</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </>
        )}
      </div>

      {/* Details panel */}
      <ProjectManagerDetailsPanel
        selectedRun={selectedRun}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onRatingChange={handleRatingChange}
        onFeedbackChange={handleFeedbackChange}
        onPromptRerun={handlePromptRerun}
      />
    </ProjectManagerLayout>
  );
};

export default ProjectManagerDashboard;
