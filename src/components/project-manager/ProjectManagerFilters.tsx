
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
        <Label htmlFor="exclude-reminder-actions">Exclude Reminders and No Actions</Label>
      </div>
      
      <PromptRunFilters
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        statusFilter={null}
        onStatusFilterChange={() => {}}
        onlyShowMyProjects={onlyMyProjects}
        onMyProjectsChange={setOnlyMyProjects}
        projectManagerFilter={projectManagerFilter}
        onProjectManagerFilterChange={setProjectManagerFilter}
        onRefresh={onRefresh}
        hideStatusFilter={true}
      />
    </div>
  );
};

export default ProjectManagerFilters;
