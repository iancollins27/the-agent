
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
          crm_id,
          next_step,
          companies(name),
          project_tracks(name)
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
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        <span>Loading projects...</span>
      </div>
    );
  }
  
  return (
    <div className="max-h-[400px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Project ID</TableHead>
            <TableHead>Track</TableHead>
            <TableHead>Current Step</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                No projects found
              </TableCell>
            </TableRow>
          ) : (
            projects.map((project) => (
              <TableRow key={project.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleProjectToggle(project.id)}>
                <TableCell>
                  <Checkbox 
                    id={`project-${project.id}`} 
                    checked={selectedProjectIds.includes(project.id)}
                    onCheckedChange={() => handleProjectToggle(project.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="font-medium">{project.companies?.name || 'Unknown'}</TableCell>
                <TableCell className="text-muted-foreground">{project.crm_id || project.id.substring(0, 8)}</TableCell>
                <TableCell>{project.project_tracks?.name || '-'}</TableCell>
                <TableCell>
                  {project.next_step ? (
                    <Badge variant="outline" className="font-normal">
                      {project.next_step}
                    </Badge>
                  ) : '-'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default ProjectSelector;
