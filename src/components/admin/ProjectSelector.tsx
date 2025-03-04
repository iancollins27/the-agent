
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type ProjectSelectorProps = {
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
};

const ProjectSelector = ({ selectedProjectId, setSelectedProjectId }: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
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
  
  return (
    <div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading projects...</span>
        </div>
      ) : (
        <Select 
          value={selectedProjectId || ''} 
          onValueChange={(value) => setSelectedProjectId(value || null)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.companies?.name || 'Unknown'} - {project.id.substring(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default ProjectSelector;
