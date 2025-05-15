
import React from 'react';
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ExternalLink, CheckSquare, Square } from 'lucide-react';
import PromptRunRating from '../PromptRunRating';
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from 'date-fns';

interface FeedbackRun {
  id: string;
  created_at: string;
  project_address: string | null;
  project_manager: string | null;
  project_crm_url: string | null;
  feedback_rating: number | null;
  feedback_description: string;
  feedback_tags: string[] | null;
  reviewed: boolean;
}

interface FeedbackRowProps {
  run: FeedbackRun;
  onClick: () => void;
  onOpenCRM: (e: React.MouseEvent, url: string) => void;
}

const FeedbackRow: React.FC<FeedbackRowProps> = ({ run, onClick, onOpenCRM }) => {
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

  return (
    <TableRow 
      key={run.id} 
      className="cursor-pointer hover:bg-slate-100"
      onClick={onClick}
    >
      <TableCell>{run.project_address || 'N/A'}</TableCell>
      <TableCell>{run.project_manager || 'No manager assigned'}</TableCell>
      <TableCell>
        <PromptRunRating 
          rating={run.feedback_rating || null} 
          size="sm"
        />
      </TableCell>
      <TableCell>{run.feedback_description}</TableCell>
      <TableCell>
        {run.feedback_tags && run.feedback_tags.length > 0 ? 
          run.feedback_tags.join(', ') : 
          'No tags'
        }
      </TableCell>
      <TableCell className="text-center">
        {run.reviewed ? 
          <CheckSquare className="h-5 w-5 text-green-500" /> : 
          <Square className="h-5 w-5 text-gray-300" />
        }
      </TableCell>
      <TableCell>{formatDate(run.created_at)}</TableCell>
      <TableCell>
        {run.project_crm_url && (
          <Button
            size="sm"
            variant="secondary"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={(e) => onOpenCRM(e, run.project_crm_url!)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open CRM
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
};

export default FeedbackRow;
