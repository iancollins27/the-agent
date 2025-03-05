
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PromptRunsTable from './PromptRunsTable';
import PromptRunDetails from './PromptRunDetails';
import { PromptRun } from './types';

const PromptRunsTab: React.FC = () => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<PromptRun | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPromptRuns();
  }, [statusFilter]);

  const fetchPromptRuns = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (crm_id),
          workflow_prompts:workflow_prompt_id (type)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Format data to include project and workflow information
      const formattedData = data.map(run => ({
        ...run,
        project_name: run.projects?.crm_id || 'Unknown Project',
        workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type'
      }));

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

  const handleRatingChange = async (promptRunId: string, rating: number) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ feedback_rating: rating })
        .eq('id', promptRunId);

      if (error) {
        throw error;
      }

      // Update local state to reflect the change
      setPromptRuns(prev => 
        prev.map(run => 
          run.id === promptRunId ? { ...run, feedback_rating: rating } : run
        )
      );

      toast({
        title: "Rating Updated",
        description: "Prompt run rating has been updated successfully",
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

  const viewPromptRunDetails = (run: PromptRun) => {
    setSelectedRun(run);
  };

  const closePromptRunDetails = () => {
    setSelectedRun(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prompt Runs</h2>
        <div className="flex space-x-4">
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
          <Button onClick={() => fetchPromptRuns()}>Refresh</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : promptRuns.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No prompt runs found</p>
          </CardContent>
        </Card>
      ) : (
        <PromptRunsTable 
          promptRuns={promptRuns} 
          onRatingChange={handleRatingChange} 
          onViewDetails={viewPromptRunDetails} 
        />
      )}

      {selectedRun && (
        <PromptRunDetails 
          promptRun={selectedRun} 
          onClose={closePromptRunDetails} 
          onRatingChange={handleRatingChange} 
        />
      )}
    </div>
  );
};

export default PromptRunsTab;
