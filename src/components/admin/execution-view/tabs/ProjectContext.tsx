
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectContextProps {
  project: any;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ project }) => {
  if (!project) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        No project information available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Project Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap">
            {project.summary || 'No summary available'}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap">
            {project.next_step || 'No next steps defined'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectContext;
