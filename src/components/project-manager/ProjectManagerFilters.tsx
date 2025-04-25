import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProjectManagerSelector from "@/components/admin/ProjectManagerSelector";

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
  onlyPendingActions: boolean;
  setOnlyPendingActions: (value: boolean) => void;
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
  onRefresh,
  onlyPendingActions,
  setOnlyPendingActions
}) => {
  const handlePendingActionsChange = (value: boolean) => {
    setOnlyPendingActions(value);
    onRefresh();
  };

  return (
    <div className="flex items-center gap-4 flex-wrap justify-between">
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
          <Label htmlFor="exclude-reminder-actions">Exclude Reminders and No Actions</Label>
        </div>

        <span className="text-sm text-muted-foreground">Show:</span>
        
        <Select 
          value={timeFilter} 
          onValueChange={setTimeFilter}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_hour">Last Hour</SelectItem>
            <SelectItem value="last_24_hours">Last 24 Hours</SelectItem>
            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        
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
        
        <div className="flex items-center space-x-2">
          <Switch
            id="only-pending-actions"
            checked={onlyPendingActions}
            onCheckedChange={handlePendingActionsChange}
          />
          <Label htmlFor="only-pending-actions">Only Show Projects with Pending Actions</Label>
        </div>
      </div>

      <Button onClick={onRefresh} variant="outline" size="icon">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ProjectManagerFilters;
