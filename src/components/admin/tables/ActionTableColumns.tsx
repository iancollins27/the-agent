
import React from 'react';
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { ActionRecord } from "@/components/admin/types";
import ActionTypeBadge from '../ActionTypeBadge';

export const getActionTableColumns = (
  getStatusBadge: (status: string) => React.ReactNode
): ColumnDef<ActionRecord>[] => [
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
        onClick={(e) => e.stopPropagation()}
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
    cell: () => null, // This will be handled in ActionRecordRow component
  },
];
