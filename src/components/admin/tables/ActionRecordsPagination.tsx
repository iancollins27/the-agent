
import React from 'react';
import { Button } from "@/components/ui/button";

interface ActionRecordsPaginationProps {
  table: any;
}

const ActionRecordsPagination: React.FC<ActionRecordsPaginationProps> = ({ table }) => {
  return (
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
  );
};

export default ActionRecordsPagination;
