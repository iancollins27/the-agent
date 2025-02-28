
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

export const ProjectSummary = ({ projectId }: { projectId?: string }) => {
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project-summary', projectId],
    queryFn: async () => {
      // If no projectId is provided, get the most recent project
      let query = supabase
        .from('projects')
        .select(`
          *,
          project_tracks (name)
        `);
      
      if (projectId) {
        query = query.eq('id', projectId);
      } else {
        query = query.order('last_action_check', { ascending: false }).limit(1);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching project summary:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return null;
      }
      
      return data[0];
    },
    enabled: true, // Always fetch the most recent project if no projectId
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <ScrollArea className="h-[200px] rounded-md border p-4">
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24 mb-2" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-md text-red-800">
        <p>Error loading project summary: {error.message}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <p>No project found</p>
      </div>
    );
  }

  // Format the last updated time
  const lastUpdated = project.last_action_check
    ? formatDistanceToNow(new Date(project.last_action_check), { addSuffix: true })
    : 'Unknown';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Project: {project.project_tracks?.name || 'Unassigned Track'}
          </h3>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">Active</Badge>
      </div>
      
      <ScrollArea className="h-[200px] rounded-md border p-4">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed">
            {project.summary || 'No summary available for this project.'}
          </p>
          
          <div className="space-y-2">
            <h4 className="font-medium">Project Details:</h4>
            <ul className="text-sm space-y-1 list-disc pl-4">
              <li>Next Step: {project.next_step || 'None specified'}</li>
              <li>Track: {project.project_tracks?.name || 'Unassigned'}</li>
              {project.crm_id && <li>CRM ID: {project.crm_id}</li>}
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
