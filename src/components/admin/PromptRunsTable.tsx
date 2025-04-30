
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
import { PromptRun, workflowTitles, WorkflowType } from './types';
import PromptRunStatusBadge from './PromptRunStatusBadge';

interface PromptRunsTableProps {
  promptRuns: PromptRun[];
  onRatingChange: (id: string, rating: number) => void;
  onViewDetails: (promptRun: PromptRun) => void;
  onRunReviewed: (id: string) => void;
  reviewFilter?: string;
  onPromptRerun?: () => void;
}

export const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const promptDate = new Date(date);
  const diffMs = now.getTime() - promptDate.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
};

const PromptRunsTable: React.FC<PromptRunsTableProps> = ({
  promptRuns,
  onRatingChange,
  onViewDetails,
  onRunReviewed,
  reviewFilter = 'all',
  onPromptRerun,
}) => {
  const handleMarkReviewed = async (id: string) => {
    try {
      onRunReviewed(id);
    } catch (error) {
      console.error('Error marking prompt run as reviewed:', error);
    }
  };

  const handleRerunPrompt = async (promptRunId: string) => {
    try {
      // Here you would implement the logic to rerun a prompt
      console.log('Rerunning prompt:', promptRunId);
      onPromptRerun?.();
    } catch (error) {
      console.error('Error rerunning prompt:', error);
    }
  };

  return (
    <Table className="border rounded-md">
      {promptRuns.length === 0 && (
        <TableCaption>No prompt runs available</TableCaption>
      )}
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {promptRuns.map((run) => (
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
                onClick={() => onViewDetails(run)}
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
