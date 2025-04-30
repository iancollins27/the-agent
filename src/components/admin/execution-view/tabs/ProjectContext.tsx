
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ProjectContextProps {
  project: any;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ project }) => {
  if (!project) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8 text-muted-foreground">
          No project context available for this execution
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Project Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Project ID</div>
              <div className="font-mono">{project.id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">CRM ID</div>
              <div>{project.crm_id || 'Not available'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Address</div>
              <div>{project.Address || 'Not available'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Track ID</div>
              <div>{project.project_track || 'Not available'}</div>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-2">Project Summary</h3>
          <div className="text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md overflow-x-auto max-h-[40vh] overflow-y-auto">
            {project.summary || 'No project summary available'}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="text-sm font-medium mb-2">Next Step</h3>
          <div className="text-sm">
            {project.next_step || 'No next step defined'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectContext;
