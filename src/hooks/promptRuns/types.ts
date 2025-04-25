
export interface UsePromptRunsProps {
  userProfile: any;
  statusFilter: string | null;
  onlyShowMyProjects: boolean;
  projectManagerFilter: string | null;
  timeFilter: string;
  getDateFilter: () => string | null;
  onlyShowLatestRuns?: boolean;
  excludeReminderActions?: boolean;
  onlyPendingActions?: boolean;
}
