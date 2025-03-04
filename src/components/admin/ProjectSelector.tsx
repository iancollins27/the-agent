
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type ProjectSelectorProps = {
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
};

const ProjectSelector = ({ selectedProjectIds, setSelectedProjectIds }: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          next_step,
          companies(name)
        `)
        .order('id');
        
      if (error) {
        console.error('Error fetching projects:', error);
      } else {
        setProjects(data || []);
      }
      setIsLoading(false);
    };
    
    fetchProjects();
  }, []);
  
  const handleProjectToggle = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds(selectedProjectIds.filter(id => id !== projectId));
    } else {
      setSelectedProjectIds([...selectedProjectIds, projectId]);
    }
  };
  
  return (
    <div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading projects...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div key={project.id} className="flex items-center space-x-2">
              <Checkbox 
                id={`project-${project.id}`} 
                checked={selectedProjectIds.includes(project.id)}
                onCheckedChange={() => handleProjectToggle(project.id)}
              />
              <Label htmlFor={`project-${project.id}`} className="flex-1">
                <span>{project.companies?.name || 'Unknown'}</span>
                <span className="mx-2">-</span>
                <span className="text-sm text-muted-foreground">{project.id.substring(0, 8)}</span>
                {project.next_step && (
                  <span className="ml-2 text-sm bg-muted px-2 py-0.5 rounded-full">
                    {project.next_step}
                  </span>
                )}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
