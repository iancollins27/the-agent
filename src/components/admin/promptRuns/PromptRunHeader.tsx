
import React from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PromptRunHeaderProps {
  statusFilter: string | null;
  setStatusFilter: (value: string | null) => void;
  fetchPromptRuns: () => void;
}

const PromptRunHeader: React.FC<PromptRunHeaderProps> = ({ 
  statusFilter, 
  setStatusFilter, 
  fetchPromptRuns 
}) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">Prompt Runs</h2>
      <div className="flex space-x-4">
        <Select 
          value={statusFilter || "all"} 
          onValueChange={(value) => setStatusFilter(value === "all" ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={fetchPromptRuns}>Refresh</Button>
      </div>
    </div>
  );
};

export default PromptRunHeader;
