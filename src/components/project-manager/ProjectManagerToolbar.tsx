
import React from 'react';
import ProjectManagerHeader from "./ProjectManagerHeader";
import ProjectManagerFilters from "./ProjectManagerFilters";

interface ProjectManagerToolbarProps {
  hideReviewed: boolean;
  excludeReminderActions: boolean;
  timeFilter: string;
  statusFilter: string | null;
  onlyMyProjects: boolean;
  projectManagerFilter: string | null;
  groupByRoofer: boolean;
  sortRooferAlphabetically: boolean;
  onlyPendingActions: boolean;
  updateFilter: <K extends string>(key: K, value: any) => void;
  fetchPromptRuns: () => void;
}

const ProjectManagerToolbar: React.FC<ProjectManagerToolbarProps> = ({
  hideReviewed,
  excludeReminderActions,
  timeFilter,
  statusFilter,
  onlyMyProjects,
  projectManagerFilter,
  groupByRoofer,
  sortRooferAlphabetically,
  onlyPendingActions,
  updateFilter,
  fetchPromptRuns
}) => {
  return (
    <div className="flex justify-between items-center flex-wrap gap-4">
      <ProjectManagerHeader title="Project Manager Dashboard" />
      <ProjectManagerFilters 
        hideReviewed={hideReviewed}
        setHideReviewed={(value) => updateFilter('hideReviewed', value)}
        excludeReminderActions={excludeReminderActions}
        setExcludeReminderActions={(value) => updateFilter('excludeReminderActions', value)}
        timeFilter={timeFilter}
        setTimeFilter={(value) => updateFilter('timeFilter', value)}
        statusFilter={statusFilter}
        setStatusFilter={(value) => updateFilter('statusFilter', value)}
        onlyMyProjects={onlyMyProjects}
        setOnlyMyProjects={(value) => updateFilter('onlyMyProjects', value)}
        projectManagerFilter={projectManagerFilter}
        setProjectManagerFilter={(value) => updateFilter('projectManagerFilter', value)}
        groupByRoofer={groupByRoofer}
        setGroupByRoofer={(value) => updateFilter('groupByRoofer', value)}
        sortRooferAlphabetically={sortRooferAlphabetically}
        setSortRooferAlphabetically={(value) => updateFilter('sortRooferAlphabetically', value)}
        onRefresh={fetchPromptRuns}
        onlyPendingActions={onlyPendingActions}
        setOnlyPendingActions={(value) => updateFilter('onlyPendingActions', value)}
      />
    </div>
  );
};

export default ProjectManagerToolbar;
