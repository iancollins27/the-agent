
import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePromptRunData } from './promptRuns/usePromptRunData';
import { Card } from "@/components/ui/card";
import { format, parseISO, isValid } from 'date-fns';

const FeedbackTab = () => {
  const { promptRuns, loading } = usePromptRunData('COMPLETED');

  // Filter prompt runs to only show those with feedback
  const feedbackRuns = promptRuns.filter(run => run.feedback_description);

  // Format date function
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return 'Invalid date';
      return format(date, 'MMM d, yyyy h:mm a');
    } catch (error) {
      return 'Invalid date';
    }
  };

  if (loading) {
    return <div>Loading feedback...</div>;
  }

  if (feedbackRuns.length === 0) {
    return <div>No feedback found.</div>;
  }

  return (
    <Card className="p-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Address</TableHead>
            <TableHead>Project Manager</TableHead>
            <TableHead>Feedback Description</TableHead>
            <TableHead>Feedback Tags</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feedbackRuns.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{run.project_address || 'N/A'}</TableCell>
              <TableCell>{run.project_manager || 'No manager assigned'}</TableCell>
              <TableCell>{run.feedback_description}</TableCell>
              <TableCell>
                {run.feedback_tags ? run.feedback_tags.join(', ') : 'No tags'}
              </TableCell>
              <TableCell>{formatDate(run.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default FeedbackTab;
