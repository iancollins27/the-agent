
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PromptRunStatusBadge from './PromptRunStatusBadge';
import PromptRunRating from './PromptRunRating';
import { PromptRun } from './types';

type PromptRunsTableProps = {
  promptRuns: PromptRun[];
  onRatingChange: (promptRunId: string, rating: number | null) => void;
  onViewDetails: (run: PromptRun) => void;
};

const PromptRunsTable: React.FC<PromptRunsTableProps> = ({ 
  promptRuns, 
  onRatingChange, 
  onViewDetails 
}) => {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Workflow Type</TableHead>
              <TableHead>AI Provider</TableHead>
              <TableHead>AI Model</TableHead>
              <TableHead>Initiated By</TableHead>
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
                <TableCell>{run.workflow_prompt_type || run.workflow_type || 'Unknown'}</TableCell>
                <TableCell>{run.ai_provider || 'Not specified'}</TableCell>
                <TableCell>{run.ai_model || 'Not specified'}</TableCell>
                <TableCell>{run.initiated_by || 'System'}</TableCell>
                <TableCell>
                  <PromptRunStatusBadge status={run.status} />
                </TableCell>
                <TableCell>
                  <PromptRunRating 
                    rating={run.feedback_rating || run.rating || null} 
                    onRatingChange={(rating) => onRatingChange(run.id, rating)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(run)}>
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PromptRunsTable;
