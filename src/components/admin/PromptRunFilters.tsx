
import React from 'react';
import { Button } from "@/components/ui/button";
import { Filter, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";
import TimeFilterSelect from "./TimeFilterSelect";
import ProjectManagerSelector from './ProjectManagerSelector';

interface PromptRunFiltersProps {
  timeFilter: string;
  onTimeFilterChange: (value: string) => void;
  statusFilter: string | null;
  onStatusFilterChange: (value: string | null) => void;
  onlyShowMyProjects: boolean;
  onMyProjectsChange: (value: boolean) => void;
  projectManagerFilter: string | null;
  onProjectManagerFilterChange: (value: string | null) => void;
  onRefresh: () => void;
  hideStatusFilter?: boolean; // New optional prop
}

const PromptRunFilters: React.FC<PromptRunFiltersProps> = ({
  timeFilter,
  onTimeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onlyShowMyProjects,
  onMyProjectsChange,
  projectManagerFilter,
  onProjectManagerFilterChange,
  onRefresh,
  hideStatusFilter = false // Default to false
}) => {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <TimeFilterSelect
        value={timeFilter}
        onChange={onTimeFilterChange}
      />
      
      <ProjectManagerSelector 
        value={projectManagerFilter} 
        onChange={onProjectManagerFilterChange} 
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
      
      {!hideStatusFilter && (
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
      )}
      
      <Button onClick={onRefresh} variant="outline" size="icon">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default PromptRunFilters;
