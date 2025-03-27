
import React from 'react';
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import TimeFilterSelect from "./TimeFilterSelect";

interface PromptRunFiltersProps {
  timeFilter: string;
  onTimeFilterChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  onlyShowMyProjects: boolean;
  onMyProjectsChange: (value: boolean) => void;
  onRefresh: () => void;
}

const PromptRunFilters: React.FC<PromptRunFiltersProps> = ({
  timeFilter,
  onTimeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onlyShowMyProjects,
  onMyProjectsChange,
  onRefresh
}) => {
  return (
    <div className="flex space-x-2 items-center">
      <TimeFilterSelect
        value={timeFilter}
        onChange={onTimeFilterChange}
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          <DropdownMenuCheckboxItem
            checked={onlyShowMyProjects}
            onCheckedChange={onMyProjectsChange}
          >
            Only My Projects
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <Select 
        value={statusFilter || "all"} 
        onValueChange={(value) => onStatusFilterChange(value === "all" ? null : value)}
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
      <Button onClick={onRefresh}>Refresh</Button>
    </div>
  );
};

export default PromptRunFilters;
