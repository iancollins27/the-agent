
import React from 'react';
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
import { Star, ExternalLink, Eye } from "lucide-react";
import { PromptRun } from './types';
import { PromptRunStatusBadge } from './PromptRunStatusBadge';
import { formatDistanceToNow } from 'date-fns';

interface PromptRunsTableProps {
  promptRuns: PromptRun[];
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onViewDetails: (promptRun: PromptRun) => void;
}

const PromptRunsTable: React.FC<PromptRunsTableProps> = ({ 
  promptRuns, 
  onRatingChange, 
  onViewDetails 
}) => {
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

  return (
    <Table>
      <TableCaption>List of recent prompt runs from your projects</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {promptRuns.map((run) => (
          <TableRow key={run.id}>
            <TableCell>{run.project_name || 'Unknown'}</TableCell>
            <TableCell>{run.project_address || 'N/A'}</TableCell>
            <TableCell>{run.workflow_prompt_type || 'Unknown'}</TableCell>
            <TableCell>
              <PromptRunStatusBadge status={run.status} />
            </TableCell>
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
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default PromptRunsTable;
