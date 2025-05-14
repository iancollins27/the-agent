
import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRelativeTime } from '@/utils/api/prompt-runs/formatPromptRunData';
import { supabase } from "@/integrations/supabase/client";
import { toast } from '@/components/ui/use-toast';

interface PromptRun {
  id: string;
  created_at: string;
  project_name?: string;
  project_address?: string;
  workflow_prompt_type?: string;
  workflow_type?: string;
  project_crm_url?: string;
  reviewed?: boolean;
}

interface PromptRunsTableProps {
  data: PromptRun[];
  refresh: () => void;
}

const PromptRunsTable: React.FC<PromptRunsTableProps> = ({
  data,
  refresh
}) => {
  // Function to mark a prompt run as reviewed
  const handleMarkReviewed = async (id: string) => {
    try {
      // Update the database
      const { error } = await supabase
        .from('prompt_runs')
        .update({ reviewed: true })
        .eq('id', id);
      
      if (error) {
        console.error('Error updating prompt run in database:', error);
        toast({
          title: "Error",
          description: "Failed to mark prompt run as reviewed",
          variant: "destructive",
        });
        return;
      }
      
      // Refresh the data to show the updated state
      refresh();
      
      toast({
        title: "Success",
        description: "Prompt run marked as reviewed",
      });
    } catch (error) {
      console.error('Error marking prompt run as reviewed:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  // Function to handle rerunning a prompt
  const handleRerunPrompt = async (promptRunId: string) => {
    try {
      toast({
        title: "Rerunning prompt",
        description: "This feature will be implemented soon",
      });
      // In the future, implement the actual rerun functionality here
    } catch (error) {
      console.error('Error rerunning prompt:', error);
      toast({
        title: "Error",
        description: "Failed to rerun prompt",
        variant: "destructive",
      });
    }
  };
  
  // Helper function to format workflow type
  const formatWorkflowType = (type: string | null | undefined): string => {
    if (!type) return 'Unknown';
    
    // Format the type string nicely
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <Table className="border rounded-md">
      {data.length === 0 && (
        <TableCaption>No prompt runs available</TableCaption>
      )}
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Workflow Type</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((run) => (
          <TableRow key={run.id} className={run.reviewed ? 'opacity-75' : ''}>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm">
                  {new Date(run.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(run.created_at)}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {run.project_name ? (
                <div className="flex flex-col">
                  <span className="font-medium">{run.project_name}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[300px] break-words">
                    {run.project_address || 'No address'}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground italic">No project</span>
              )}
            </TableCell>
            <TableCell>
              {formatWorkflowType(run.workflow_prompt_type || run.workflow_type)}
            </TableCell>
            <TableCell className="text-right space-x-2">
              {!run.reviewed && (
                <Button
                  onClick={() => handleMarkReviewed(run.id)}
                  size="sm"
                  variant="secondary"
                >
                  Mark as reviewed
                </Button>
              )}
              <Button
                onClick={() => {/* View details implementation */}}
                size="sm"
                variant="default"
              >
                View details
              </Button>
              <Button
                onClick={() => handleRerunPrompt(run.id)}
                size="sm"
                variant="outline"
                title="Rerun prompt"
              >
                <RotateCw className="h-4 w-4 mr-1" />
                Rerun
              </Button>
              {run.project_crm_url && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  asChild
                >
                  <Link
                    to={run.project_crm_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open CRM
                  </Link>
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PromptRunsTable;
