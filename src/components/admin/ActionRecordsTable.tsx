
import React from 'react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table";
import { ActionRecord } from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import ActionRecordRow from './tables/ActionRecordRow';
import ActionRecordsPagination from './tables/ActionRecordsPagination';
import { getActionTableColumns } from './tables/ActionTableColumns';

interface ActionRecordsTableProps {
  data: ActionRecord[];
  rowSelection: Record<string, boolean>;
  setRowSelection: (selection: Record<string, boolean>) => void;
  onApprove: (action: ActionRecord) => void;
  onReject: (action: ActionRecord) => void;
  onViewDetails: (action: ActionRecord) => void;
}

const ActionRecordsTable: React.FC<ActionRecordsTableProps> = ({
  data,
  rowSelection,
  setRowSelection,
  onApprove,
  onReject,
  onViewDetails
}) => {
  const [isApproving, setIsApproving] = React.useState<Record<string, boolean>>({});
  const [isRejecting, setIsRejecting] = React.useState<Record<string, boolean>>({});
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">Rejected</Badge>;
      case 'executed':
        return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Executed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleApproveClick = async (action: ActionRecord) => {
    setIsApproving({...isApproving, [action.id]: true});
    try {
      await onApprove(action);
    } finally {
      setIsApproving({...isApproving, [action.id]: false});
    }
  };

  const handleRejectClick = async (action: ActionRecord) => {
    setIsRejecting({...isRejecting, [action.id]: true});
    try {
      await onReject(action);
    } finally {
      setIsRejecting({...isRejecting, [action.id]: false});
    }
  };

  const columns = getActionTableColumns(getStatusBadge);

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())
                    }
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <ActionRecordRow
                  key={row.id}
                  row={row}
                  onViewDetails={onViewDetails}
                  onApprove={handleApproveClick}
                  onReject={handleRejectClick}
                  isApproving={isApproving}
                  isRejecting={isRejecting}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <ActionRecordsPagination table={table} />
    </div>
  );
};

export default ActionRecordsTable;
