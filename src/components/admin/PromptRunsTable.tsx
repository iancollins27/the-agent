import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Eye, CheckSquare, RefreshCw } from "lucide-react";
import { PromptRun } from './types';
import { formatDistanceToNow } from 'date-fns';
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { rerunPrompt } from "@/utils/api/prompt-runs";

interface PromptRunsTableProps {
  promptRuns: PromptRun[];
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onViewDetails: (promptRun: PromptRun) => void;
  onRunReviewed?: (promptRunId: string) => void;
  reviewFilter?: string;
  hideReviewed?: boolean; // Kept for backward compatibility
  onPromptRerun?: () => void; // New callback to refresh data after rerun
}

const PromptRunsTable: React.FC<PromptRunsTableProps> = ({ 
  promptRuns, 
  onRatingChange, 
  onViewDetails,
  onRunReviewed,
  reviewFilter = "all", // Default to showing all
  hideReviewed = false, // Deprecated, kept for backward compatibility
  onPromptRerun
}) => {
  const [rerunningPrompts, setRerunningPrompts] = useState<Record<string, boolean>>({});
  
  // Function to render stars for rating
  const renderStars = (promptRun: PromptRun) => {
    const rating = promptRun.feedback_rating || 0;
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 cursor-pointer ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
            onClick={() => onRatingChange(promptRun.id, star === rating ? null : star)}
          />
        ))}
      </div>
    );
  };

  const handleMarkAsReviewed = async (promptRun: PromptRun) => {
    try {
      const { error } = await supabase
        .from('prompt_runs')
        .update({ reviewed: true })
        .eq('id', promptRun.id);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Success",
        description: "Prompt run marked as reviewed",
      });
      
      if (onRunReviewed) {
        onRunReviewed(promptRun.id);
      }
    } catch (error) {
      console.error('Error marking prompt run as reviewed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark prompt run as reviewed",
      });
    }
  };

  const handleRerunPrompt = async (promptRun: PromptRun) => {
    try {
      setRerunningPrompts((prev) => ({ ...prev, [promptRun.id]: true }));
      
      const result = await rerunPrompt(promptRun.id);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Prompt has been re-run. New prompt run created with ID: ${result.newPromptRunId}`,
        });
        
        if (onPromptRerun) {
          onPromptRerun();
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to re-run prompt: ${result.error}`,
        });
      }
    } catch (error) {
      console.error('Error re-running prompt:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while re-running the prompt",
      });
    } finally {
      setRerunningPrompts((prev) => ({ ...prev, [promptRun.id]: false }));
    }
  };

  // Filter runs based on the reviewFilter prop
  const filteredPromptRuns = promptRuns.filter(run => {
    if (reviewFilter === "all") return true;
    if (reviewFilter === "reviewed") return run.reviewed === true;
    if (reviewFilter === "not-reviewed") return run.reviewed !== true;
    
    // For backward compatibility
    if (hideReviewed) return !run.reviewed;
    
    return true;
  });

  return (
    <Table>
      <TableCaption>List of recent prompt runs from your projects</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Address</TableHead>
          <TableHead>Next Step</TableHead>
          <TableHead>Roofer</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredPromptRuns.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-6">
              {reviewFilter === "reviewed" 
                ? "No reviewed prompt runs found." 
                : reviewFilter === "not-reviewed"
                ? "All prompt runs have been reviewed. Great job!" 
                : "No prompt runs found matching your criteria."}
            </TableCell>
          </TableRow>
        ) : (
          filteredPromptRuns.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{run.project_address || 'N/A'}</TableCell>
              <TableCell className="max-w-[300px] truncate">{run.project_next_step || 'No next step defined'}</TableCell>
              <TableCell>{run.project_roofer_contact || 'No roofer assigned'}</TableCell>
              <TableCell>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</TableCell>
              <TableCell>{renderStars(run)}</TableCell>
              <TableCell className="text-right space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onViewDetails(run)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                
                {run.project_crm_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(run.project_crm_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    CRM
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  size="sm"
                  className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                  onClick={() => handleMarkAsReviewed(run)}
                  disabled={run.reviewed}
                >
                  <CheckSquare className="h-4 w-4 mr-1" />
                  {run.reviewed ? "Reviewed" : "Mark Reviewed"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                  onClick={() => handleRerunPrompt(run)}
                  disabled={rerunningPrompts[run.id]}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${rerunningPrompts[run.id] ? 'animate-spin' : ''}`} />
                  {rerunningPrompts[run.id] ? "Running..." : "Re-run"}
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

export default PromptRunsTable;
