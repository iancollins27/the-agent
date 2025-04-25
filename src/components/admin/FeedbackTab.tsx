
import React from 'react';
import { useFeedbackTable } from './feedback/useFeedbackTable';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Star } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

const FeedbackTab = () => {
  const { promptRuns, loading } = useFeedbackTable();

  // Render stars based on rating
  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div>Loading feedback data...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Prompt Run Feedback</h2>
      
      <Table>
        <TableCaption>List of prompt runs with feedback</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Feedback</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {promptRuns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No feedback found.
              </TableCell>
            </TableRow>
          ) : (
            promptRuns.map((run) => (
              <TableRow key={run.id}>
                <TableCell>{run.project_name || 'Unknown Project'}</TableCell>
                <TableCell>{run.feedback_rating ? renderStars(run.feedback_rating) : 'No rating'}</TableCell>
                <TableCell className="max-w-md">{run.feedback_description || 'No description'}</TableCell>
                <TableCell>
                  {run.feedback_tags && run.feedback_tags.length > 0 ? 
                    run.feedback_tags.map((tag, index) => (
                      <span 
                        key={index}
                        className="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
                      >
                        {tag}
                      </span>
                    )) : 'No tags'
                  }
                </TableCell>
                <TableCell>{formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}</TableCell>
                <TableCell>
                  {run.project_crm_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(run.project_crm_url, '_blank')}
                    >
                      View in CRM
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default FeedbackTab;
