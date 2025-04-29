
import { useAuth } from "@/hooks/useAuth";

export const useEmptyStateMessage = (
  userProfile: any, 
  filters: {
    onlyMyProjects: boolean;
    projectManagerFilter: string | null;
    statusFilter: string | null;
    timeFilter: string;
  },
  fetchError: string | null
) => {
  const { user } = useAuth();
  
  // Generate appropriate empty state message
  const getEmptyStateMessage = () => {
    if (!user) {
      return "Please log in to view your project data";
    }
    
    if (!userProfile?.profile_associated_company) {
      return "Your user profile is not associated with a company. Contact your administrator.";
    }
    
    if (fetchError) {
      return `Error loading data: ${fetchError}. Try refreshing the page or try again with fewer filters.`;
    }
    
    if (filters.onlyMyProjects) {
      return "No prompt runs found for your projects. Try unchecking 'Only My Projects' filter.";
    }
    
    if (filters.projectManagerFilter) {
      return "No prompt runs found for the selected project manager's projects.";
    }
    
    if (filters.statusFilter) {
      return `No prompt runs found with the '${filters.statusFilter}' status. Try selecting a different status.`;
    }
    
    if (filters.timeFilter !== 'all') {
      return `No prompt runs found within the selected time range. Try selecting a different time range.`;
    }
    
    return "No prompt runs found for your company's projects. This could be because:\n1. No prompt runs have been created yet\n2. You don't have access to the projects with prompt runs";
  };

  return { getEmptyStateMessage };
};
