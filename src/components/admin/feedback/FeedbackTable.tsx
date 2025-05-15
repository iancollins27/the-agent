
import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import FeedbackRow from './FeedbackRow';

interface FeedbackRun {
  id: string;
  created_at: string;
  status: string;
  ai_provider: string;
  ai_model: string;
  prompt_input: string;
  prompt_output: string | null;
  error_message: string | null;
  error: boolean;
  feedback_description: string;
  feedback_rating: number | null;
  feedback_review: string | null;
  feedback_tags: string[] | null;
  project_address: string | null;
  project_manager: string | null;
  project_crm_url: string | null;
  reviewed: boolean;
}

interface FeedbackTableProps {
  feedbackRuns: FeedbackRun[];
  loading: boolean;
  onRowClick: (run: FeedbackRun) => void;
  onOpenCRM: (e: React.MouseEvent, url: string) => void;
}

const FeedbackTable: React.FC<FeedbackTableProps> = ({ 
  feedbackRuns, 
  loading,
  onRowClick,
  onOpenCRM 
}) => {
  if (loading) {
    return <div className="p-4 text-center">Loading feedback data...</div>;
  }

  if (feedbackRuns.length === 0) {
    return <div className="p-4 text-center">No feedback found.</div>;
  }

  return (
    <Card className="p-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Address</TableHead>
            <TableHead>Project Manager</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Feedback Description</TableHead>
            <TableHead>Feedback Tags</TableHead>
            <TableHead>Feedback Reviewed</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feedbackRuns.map((run) => (
            <FeedbackRow 
              key={run.id}
              run={run}
              onClick={() => onRowClick(run)}
              onOpenCRM={onOpenCRM}
            />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default FeedbackTable;
