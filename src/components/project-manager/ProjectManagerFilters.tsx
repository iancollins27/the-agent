
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import PromptRunFilters from '../admin/PromptRunFilters';

interface ProjectManagerFiltersProps {
  hideReviewed: boolean;
  setHideReviewed: (value: boolean) => void;
  excludeReminderActions: boolean;
  setExcludeReminderActions: (value: boolean) => void;
  timeFilter: string;
  setTimeFilter: (value: string) => void;
  statusFilter: string | null;
  setStatusFilter: (value: string | null) => void;
  onlyMyProjects: boolean;
  setOnlyMyProjects: (value: boolean) => void;
  projectManagerFilter: string | null;
  setProjectManagerFilter: (value: string | null) => void;
  groupByRoofer: boolean;
  setGroupByRoofer: (value: boolean) => void;
  sortRooferAlphabetically: boolean;
  setSortRooferAlphabetically: (value: boolean) => void;
  onRefresh: () => void;
}

const ProjectManagerFilters: React.FC<ProjectManagerFiltersProps> = ({
  hideReviewed,
  setHideReviewed,
  excludeReminderActions,
  setExcludeReminderActions,
  timeFilter,
  setTimeFilter,
  statusFilter,
  setStatusFilter,
  onlyMyProjects,
  setOnlyMyProjects,
  projectManagerFilter,
  setProjectManagerFilter,
  groupByRoofer,
  setGroupByRoofer,
  sortRooferAlphabetically,
  setSortRooferAlphabetically,
  onRefresh
}) => {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center space-x-2">
        <Switch
          id="hide-reviewed"
          checked={hideReviewed}
          onCheckedChange={setHideReviewed}
        />
        <Label htmlFor="hide-reviewed">Hide Reviewed</Label>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="exclude-reminder-actions"
          checked={excludeReminderActions}
          onCheckedChange={setExcludeReminderActions}
        />
        <Label htmlFor="exclude-reminder-actions">Exclude Reminder Actions</Label>
      </div>
      
      {/* Custom filter dropdown for roofer grouping and sorting */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[240px]">
          <DropdownMenuCheckboxItem
            checked={onlyMyProjects}
            onCheckedChange={setOnlyMyProjects}
          >
            Only My Projects
          </DropdownMenuCheckboxItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuCheckboxItem
            checked={groupByRoofer}
            onCheckedChange={setGroupByRoofer}
          >
            Group by Roofer
          </DropdownMenuCheckboxItem>
          
          {groupByRoofer && (
            <DropdownMenuCheckboxItem
              checked={sortRooferAlphabetically}
              onCheckedChange={setSortRooferAlphabetically}
              className="pl-8"
            >
              Sort Alphabetically
            </DropdownMenuCheckboxItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <PromptRunFilters
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        statusFilter={null} // Remove status filter
        onStatusFilterChange={() => {}} // No-op function
        onlyShowMyProjects={onlyMyProjects}
        onMyProjectsChange={setOnlyMyProjects}
        projectManagerFilter={projectManagerFilter}
        onProjectManagerFilterChange={setProjectManagerFilter}
        onRefresh={onRefresh}
        hideStatusFilter={true} // Add a prop to hide status filter in child component
      />
    </div>
  );
};

export default ProjectManagerFilters;
