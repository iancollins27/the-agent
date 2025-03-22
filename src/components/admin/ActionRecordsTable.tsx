
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ActionRecord } from "@/components/admin/types"
import { Badge } from "@/components/ui/badge"
import { Check, X, MoreHorizontal, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { format, isValid, parseISO } from "date-fns"

interface ActionRecordsTableProps {
  data: ActionRecord[]
  rowSelection: any
  setRowSelection: (rowSelection: any) => void
  onApprove?: (action: ActionRecord) => void
  onReject?: (action: ActionRecord) => void
}

const ActionStatusCell = ({ status }: { status: string }) => {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'executed':
        return {
          variant: "outline" as const,
          className: "bg-green-100 text-green-800 border-green-200"
        };
      case 'failed':
        return {
          variant: "destructive" as const
        };
      case 'pending':
        return {
          variant: "outline" as const
        };
      case 'approved':
        return {
          variant: "default" as const
        };
      case 'rejected':
        return {
          variant: "destructive" as const
        };
      default:
        return {
          variant: "outline" as const
        };
    }
  };

  const statusVariant = getStatusVariant(status);

  return <Badge {...statusVariant}>{status}</Badge>;
};

const formatDate = (dateString: string) => {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Invalid date';
    return format(date, 'MMM d, yyyy h:mm a');
  } catch (error) {
    return 'Invalid date';
  }
};

const ActionRecordsTable: React.FC<ActionRecordsTableProps> = ({ 
  data, 
  rowSelection, 
  setRowSelection,
  onApprove,
  onReject
}) => {
  const columns: ColumnDef<ActionRecord>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "created_at",
      header: "Created At",
      cell: ({ row }) => formatDate(row.original.created_at)
    },
    {
      accessorKey: "action_type",
      header: "Action Type",
      cell: ({ row }) => (
        <span className="capitalize">{row.original.action_type.replace(/_/g, ' ')}</span>
      )
    },
    {
      accessorKey: "sender_name",
      header: "Sender",
      cell: ({ row }) => row.original.sender_name || 'System'
    },
    {
      accessorKey: "recipient_name",
      header: "Recipient",
      cell: ({ row }) => row.original.recipient_name || 'N/A'
    },
    {
      accessorKey: "project_address",
      header: "Address",
      cell: ({ row }) => {
        const address = row.original.project_address || 
                       (row.original.action_payload && typeof row.original.action_payload === 'object' && 
                        'address' in row.original.action_payload ? 
                        row.original.action_payload.address as string : null);
                        
        return address ? (
          <div className="flex items-center max-w-xs">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0 text-slate-400" />
            <span className="truncate">{address}</span>
          </div>
        ) : (
          <span className="text-slate-400">No address</span>
        );
      }
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <ActionStatusCell status={row.original.status} />
      ),
    },
    {
      accessorKey: "message",
      header: "Message",
      cell: ({ row }) => (
        <div className="max-w-xs truncate">
          {row.original.message || 'No message'}
        </div>
      )
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const action = row.original;
        const isPending = action.status.toLowerCase() === 'pending';

        return (
          <div className="flex gap-2">
            {isPending && onApprove && onReject && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700"
                  onClick={() => onApprove(action)}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
                  onClick={() => onReject(action)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(action.id)}
                >
                  Copy action ID
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View details</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ];

  const table = useReactTable({
    data,
    columns,
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default ActionRecordsTable
