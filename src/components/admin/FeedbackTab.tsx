
import React from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePromptRunData } from './promptRuns/usePromptRunData';
import { Card } from "@/components/ui/card";

const FeedbackTab = () => {
  const { promptRuns, loading } = usePromptRunData('COMPLETED');

  // Filter prompt runs to only show those with feedback
  const feedbackRuns = promptRuns.filter(run => run.feedback_description);

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
            <TableHead>Feedback Description</TableHead>
            <TableHead>Project Address</TableHead>
            <TableHead>Feedback Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feedbackRuns.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{run.feedback_description}</TableCell>
              <TableCell>{run.project_address || 'N/A'}</TableCell>
              <TableCell>
                {run.feedback_tags ? run.feedback_tags.join(', ') : 'No tags'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default FeedbackTab;
