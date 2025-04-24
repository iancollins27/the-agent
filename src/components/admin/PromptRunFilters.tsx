
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
  setTimeFilter: (value: string) => void;
  statusFilter: string | null;
  setStatusFilter: (value: string | null) => void;
  onlyShowMyProjects: boolean;
  setOnlyShowMyProjects: (value: boolean) => void;
  projectManagerFilter: string | null;
  setProjectManagerFilter: (value: string | null) => void;
  refreshData: () => void;
  isRefreshing: boolean;
  excludeReminders: boolean;
  setExcludeReminders: (value: boolean) => void;
  onlyShowLatest: boolean;
  setOnlyShowLatest: (value: boolean) => void;
}

const PromptRunFilters: React.FC<PromptRunFiltersProps> = ({
  timeFilter,
  setTimeFilter,
  statusFilter,
  setStatusFilter,
  onlyShowMyProjects,
  setOnlyShowMyProjects,
  projectManagerFilter,
  setProjectManagerFilter,
  refreshData,
  isRefreshing,
  excludeReminders,
  setExcludeReminders,
  onlyShowLatest,
  setOnlyShowLatest
}) => {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <TimeFilterSelect
        value={timeFilter}
        onChange={setTimeFilter}
      />
      
      <ProjectManagerSelector 
        value={projectManagerFilter} 
        onChange={setProjectManagerFilter} 
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
            onCheckedChange={setOnlyShowMyProjects}
          >
            Only My Projects
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={excludeReminders}
            onCheckedChange={setExcludeReminders}
          >
            Exclude Reminders
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={onlyShowLatest}
            onCheckedChange={setOnlyShowLatest}
          >
            Only Latest Runs
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
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
      
      <Button 
        onClick={refreshData} 
        variant="outline" 
        size="icon"
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
};

export default PromptRunFilters;
