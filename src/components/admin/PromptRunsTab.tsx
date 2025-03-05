
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

type PromptRun = {
  id: string;
  project_id: string | null;
  workflow_prompt_id: string | null;
  prompt_input: string;
  prompt_output: string | null;
  feedback_description: string | null;
  feedback_tags: string[] | null;
  feedback_rating: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  project_name?: string;
  workflow_prompt_type?: string;
};

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

  const getStatusBadgeStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
        return 'bg-green-500';
      case 'ERROR':
        return 'bg-red-500';
      case 'PENDING':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Prompt Runs</h2>
        <div className="flex space-x-4">
          <Select 
            value={statusFilter || ""} 
            onValueChange={(value) => setStatusFilter(value || null)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Workflow Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promptRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      {new Date(run.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{run.project_name}</TableCell>
                    <TableCell>{run.workflow_prompt_type}</TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeStyle(run.status)}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 cursor-pointer ${
                              (run.feedback_rating || 0) >= star
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                            onClick={() => handleRatingChange(run.id, star)}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => viewPromptRunDetails(run)}>
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {selectedRun && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Prompt Run Details</CardTitle>
            <CardDescription>
              Created at {new Date(selectedRun.created_at).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Prompt Input</h3>
              <pre className="bg-slate-100 p-4 rounded overflow-auto max-h-60 text-sm">
                {selectedRun.prompt_input}
              </pre>
            </div>
            
            {selectedRun.prompt_output && (
              <div>
                <h3 className="font-medium mb-2">Prompt Output</h3>
                <pre className="bg-slate-100 p-4 rounded overflow-auto max-h-60 text-sm">
                  {selectedRun.prompt_output}
                </pre>
              </div>
            )}
            
            {selectedRun.error_message && (
              <div>
                <h3 className="font-medium mb-2 text-red-500">Error</h3>
                <pre className="bg-red-50 p-4 rounded overflow-auto max-h-60 text-sm text-red-500">
                  {selectedRun.error_message}
                </pre>
              </div>
            )}
            
            <div className="pt-4">
              <h3 className="font-medium mb-2">Feedback</h3>
              <div className="flex space-x-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 cursor-pointer ${
                      (selectedRun.feedback_rating || 0) >= star
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                    onClick={() => handleRatingChange(selectedRun.id, star)}
                  />
                ))}
              </div>
              
              {selectedRun.feedback_description && (
                <p className="text-sm">{selectedRun.feedback_description}</p>
              )}
              
              {selectedRun.feedback_tags && selectedRun.feedback_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedRun.feedback_tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            
            <Button 
              variant="secondary" 
              onClick={() => setSelectedRun(null)}
              className="mt-4"
            >
              Close Details
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PromptRunsTab;
