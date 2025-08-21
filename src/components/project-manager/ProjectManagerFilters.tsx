
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
  // Refresh is now called directly from all filter change handlers
  const handleFilterChange = (setter: (value: any) => void, value: any) => {
    setter(value);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Mobile-first: Stack key filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="hide-reviewed"
            checked={hideReviewed}
            onCheckedChange={(value) => handleFilterChange(setHideReviewed, value)}
          />
          <Label htmlFor="hide-reviewed" className="text-sm">Hide Reviewed</Label>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="exclude-reminder-actions"
            checked={excludeReminderActions}
            onCheckedChange={(value) => handleFilterChange(setExcludeReminderActions, value)}
          />
          <Label htmlFor="exclude-reminder-actions" className="text-sm">Exclude Reminders</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="only-pending-actions"
            checked={onlyPendingActions}
            onCheckedChange={(value) => handleFilterChange(setOnlyPendingActions, value)}
          />
          <Label htmlFor="only-pending-actions" className="text-sm">Pending Actions Only</Label>
        </div>
      </div>

      {/* Second row: Selectors and filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
        <span className="text-sm text-muted-foreground hidden sm:inline">Show:</span>
        
        <Select 
          value={timeFilter} 
          onValueChange={(value) => handleFilterChange(setTimeFilter, value)}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_hour">Last Hour</SelectItem>
            <SelectItem value="last_24_hours">Last 24 Hours</SelectItem>
            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="w-full sm:w-auto">
          <ProjectManagerSelector 
            value={projectManagerFilter} 
            onChange={(value) => handleFilterChange(setProjectManagerFilter, value)}
          />
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">More Filters</span>
                <span className="sm:hidden">Filters</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px] bg-white z-50">
              <DropdownMenuCheckboxItem
                checked={onlyMyProjects}
                onCheckedChange={(value) => handleFilterChange(setOnlyMyProjects, value)}
              >
                Only My Projects
              </DropdownMenuCheckboxItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuCheckboxItem
                checked={groupByRoofer}
                onCheckedChange={(value) => handleFilterChange(setGroupByRoofer, value)}
              >
                Group by Roofer
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectManagerFilters;
