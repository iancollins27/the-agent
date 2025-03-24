
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Edit, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { ActionRecord } from "@/components/admin/types";
import ActionTypeBadge from './ActionTypeBadge';
import { cn } from "@/lib/utils";

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

  const columns: ColumnDef<ActionRecord>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "action_type",
      header: "Type",
      cell: ({ row }) => <ActionTypeBadge type={row.getValue("action_type")} />,
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => {
        const date = new Date(row.getValue("created_at") as string);
        return <span>{date.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const record = row.original;
        const actionPayload = record.action_payload as Record<string, any>;
        const description = actionPayload?.description || record.message || '';
        
        return (
          <div className="line-clamp-2 max-w-[300px]">
            {description}
          </div>
        );
      },
    },
    {
      accessorKey: "project_name",
      header: "Project",
      cell: ({ row }) => {
        const projectName = row.original.project_name;
        const projectAddress = row.original.project_address;
        
        return (
          <div>
            <div className="font-medium">{projectName || 'N/A'}</div>
            {projectAddress && <div className="text-xs text-muted-foreground">{projectAddress}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getStatusBadge(row.getValue("status") as string),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const action = row.original;
        
        return (
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
                    handleApproveClick(action);
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
                    handleRejectClick(action);
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
        );
      },
    },
  ];

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
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onViewDetails(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
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
      
      <div className="flex items-center justify-end space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default ActionRecordsTable;
