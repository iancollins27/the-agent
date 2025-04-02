
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Edit, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import { ActionRecord } from "@/components/admin/types";
import ActionTypeBadge from '../ActionTypeBadge';
import { cn } from "@/lib/utils";

interface ActionRecordRowProps {
  row: any;
  onViewDetails: (action: ActionRecord) => void;
  onApprove: (action: ActionRecord) => void;
  onReject: (action: ActionRecord) => void;
  isApproving: Record<string, boolean>;
  isRejecting: Record<string, boolean>;
}

const ActionRecordRow: React.FC<ActionRecordRowProps> = ({
  row,
  onViewDetails,
  onApprove,
  onReject,
  isApproving,
  isRejecting
}) => {
  const action = row.original;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full border-amber-200 text-amber-700 bg-amber-50">Pending</span>;
      case 'approved':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full border-green-200 text-green-700 bg-green-50">Approved</span>;
      case 'rejected':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full border-red-200 text-red-700 bg-red-50">Rejected</span>;
      case 'executed':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full border-blue-200 text-blue-700 bg-blue-50">Executed</span>;
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full">{status}</span>;
    }
  };
  
  return (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() && "selected"}
      className="cursor-pointer hover:bg-muted/40"
      onClick={() => onViewDetails(action)}
    >
      {row.getVisibleCells().map((cell: any) => {
        // Special handling for the actions column
        if (cell.column.id === "actions") {
          return (
            <TableCell key={cell.id}>
              <div className="flex items-center gap-2 justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(action);
                  }}
                >
                  <Edit className="h-4 w-4 text-muted-foreground" />
                  <span className="sr-only">Edit</span>
                </Button>
                
                {action.status === 'pending' && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onApprove(action);
                      }}
                      disabled={isApproving[action.id]}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      {isApproving[action.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Approve</span>
                    </Button>
                    
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onReject(action);
                      }}
                      disabled={isRejecting[action.id]}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {isRejecting[action.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span className="sr-only">Reject</span>
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          );
        } 
        
        // Render other cells normally
        return (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
};

export default ActionRecordRow;
