
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectSummary } from "./ProjectSummary";
import { ActionCenter } from "./ActionCenter";
import { CommunicationLog } from "./CommunicationLog";
import { ProjectTimeline } from "./ProjectTimeline";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // Fetch available projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, summary, project_track')
        .order('id', { ascending: false });
      
      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
      
      return data;
    }
  });

  // Set the first project as selected when data loads
  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Project Manager</h1>
          <p className="text-muted-foreground">Intelligent project oversight and management</p>
        </div>
        <div className="flex items-center gap-4">
          {!isLoading && projects && projects.length > 0 && (
            <select 
              className="border rounded-md p-2 text-sm"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  Project {project.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Project Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectSummary projectId={selectedProjectId} />
          </CardContent>
        </Card>

        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Action Center</CardTitle>
          </CardHeader>
          <CardContent>
            <ActionCenter />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Communication Log</CardTitle>
          </CardHeader>
          <CardContent>
            <CommunicationLog />
          </CardContent>
        </Card>

        <Card className="slide-in">
          <CardHeader>
            <CardTitle>Project Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectTimeline />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
