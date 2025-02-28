
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type ProjectSummaryProps = {
  projectId?: string;
};

export const ProjectSummary = ({ projectId }: ProjectSummaryProps) => {
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          summary,
          project_track,
          project_tracks (name)
        `)
        .eq('id', projectId)
        .single();
      
      if (error) {
        console.error('Error fetching project:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!projectId
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-destructive">
        <p>Error loading project summary: {(error as Error).message}</p>
      </div>
    );
  }

  if (!project && !isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">No Project Selected</h3>
            <p className="text-sm text-muted-foreground">Select a project to view details</p>
          </div>
        </div>
        
        <div className="h-[200px] rounded-md border p-4 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No project data available</p>
        </div>
      </div>
    );
  }

  // Format the last updated time
  const lastUpdated = project?.summary ? "Recently updated" : "No updates yet";
  const projectStatus = "Active"; // This could come from the project data in the future
  const trackName = project?.project_tracks?.name || "No Track";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project: {trackName}</h3>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">{projectStatus}</Badge>
      </div>
      
      <ScrollArea className="h-[200px] rounded-md border p-4">
        <div className="space-y-4">
          {project?.summary ? (
            <p className="text-sm leading-relaxed">
              {project.summary}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No summary available for this project yet.
            </p>
          )}
          
          <div className="space-y-2">
            <h4 className="font-medium">Key Points:</h4>
            <ul className="text-sm space-y-1 list-disc pl-4">
              <li>Budget: On track</li>
              <li>Timeline: Within schedule</li>
              <li>Customer Satisfaction: High</li>
              <li>Risk Level: Low</li>
            </ul>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
