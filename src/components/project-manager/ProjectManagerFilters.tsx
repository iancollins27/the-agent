
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PromptRunFilters from '../admin/PromptRunFilters';

interface ProjectManagerFiltersProps {
  hideReviewed: boolean;
  setHideReviewed: (value: boolean) => void;
  timeFilter: string;
  setTimeFilter: (value: string) => void;
  statusFilter: string | null;
  setStatusFilter: (value: string | null) => void;
  onlyMyProjects: boolean;
  setOnlyMyProjects: (value: boolean) => void;
  projectManagerFilter: string | null;
  setProjectManagerFilter: (value: string | null) => void;
  onRefresh: () => void;
}

const ProjectManagerFilters: React.FC<ProjectManagerFiltersProps> = ({
  hideReviewed,
  setHideReviewed,
  timeFilter,
  setTimeFilter,
  statusFilter,
  setStatusFilter,
  onlyMyProjects,
  setOnlyMyProjects,
  projectManagerFilter,
  setProjectManagerFilter,
  onRefresh
}) => {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="hide-reviewed"
          checked={hideReviewed}
          onCheckedChange={setHideReviewed}
        />
        <Label htmlFor="hide-reviewed">Hide Reviewed</Label>
      </div>
      
      <PromptRunFilters
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onlyShowMyProjects={onlyMyProjects}
        onMyProjectsChange={setOnlyMyProjects}
        projectManagerFilter={projectManagerFilter}
        onProjectManagerFilterChange={setProjectManagerFilter}
        onRefresh={onRefresh}
      />
    </div>
  );
};

export default ProjectManagerFilters;
