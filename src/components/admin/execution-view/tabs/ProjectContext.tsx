
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ProjectContextProps {
  project: {
    id: string;
    summary?: string;
    next_step?: string;
    project_track?: string;
    Address?: string;
    crm_id?: string;
  } | null;
}

const ProjectContext: React.FC<ProjectContextProps> = ({ project }) => {
  if (!project) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No project context available.
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {project.summary && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Summary</h3>
            <p className="text-sm">{project.summary}</p>
          </div>
        )}
        
        {project.next_step && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Next Step</h3>
            <p className="text-sm">{project.next_step}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.project_track && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Track ID</h3>
              <p className="text-sm font-mono">{project.project_track}</p>
            </div>
          )}
          
          {project.crm_id && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">CRM ID</h3>
              <p className="text-sm font-mono">{project.crm_id}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectContext;
