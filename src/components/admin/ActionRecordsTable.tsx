
import React from 'react';
import { ActionRecord } from './types';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ActionTypeBadge from './ActionTypeBadge';
import ActionRecordEdit from './ActionRecordEdit';

interface ActionRecordsTableProps {
  actionRecords: ActionRecord[];
  processingAction: string | null;
  onApprove: (actionId: string) => void;
  onEditSuccess: () => void;
}

const ActionRecordsTable: React.FC<ActionRecordsTableProps> = ({ 
  actionRecords, 
  processingAction, 
  onApprove,
  onEditSuccess
}) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Type</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead className="w-[200px]">Description</TableHead>
            <TableHead className="w-[150px]">Created</TableHead>
            <TableHead className="w-[150px]">Recipient</TableHead>
            <TableHead className="max-w-[250px]">Message</TableHead>
            <TableHead className="w-[120px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actionRecords.map((action) => (
            <TableRow key={action.id}>
              <TableCell><ActionTypeBadge type={action.action_type} /></TableCell>
              <TableCell>{action.project_name}</TableCell>
              <TableCell>
                {action.action_payload && typeof action.action_payload === 'object' && 'description' in action.action_payload ? 
                 action.action_payload.description : 'No description provided'}
              </TableCell>
              <TableCell>{action.created_at ? formatDate(action.created_at) : 'Unknown'}</TableCell>
              <TableCell>
                <ActionRecordEdit 
                  record={action}
                  field="recipient_name"
                  onSuccess={onEditSuccess}
                />
              </TableCell>
              <TableCell className="max-w-[250px]">
                <ActionRecordEdit 
                  record={action}
                  field="message"
                  onSuccess={onEditSuccess}
                />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button 
                  onClick={() => onApprove(action.id)}
                  disabled={processingAction === action.id}
                  size="sm"
                >
                  {processingAction === action.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ActionRecordsTable;
