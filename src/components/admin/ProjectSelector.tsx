
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Search } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ProjectSelectorProps = {
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
};

const ProjectSelector = ({ selectedProjectIds, setSelectedProjectIds }: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          crm_id,
          next_step,
          Address,
          companies(name),
          project_tracks(name)
        `)
        .order('id');
        
      if (error) {
        console.error('Error fetching projects:', error);
      } else {
        setProjects(data || []);
        setFilteredProjects(data || []);
      }
      setIsLoading(false);
    };
    
    fetchProjects();
  }, []);
  
  useEffect(() => {
    // Filter projects when search term changes
    if (searchTerm.trim() === "") {
      setFilteredProjects(projects);
    } else {
      const term = searchTerm.toLowerCase().trim();
      const filtered = projects.filter(project => 
        project.Address && project.Address.toLowerCase().includes(term)
      );
      setFilteredProjects(filtered);
    }
  }, [searchTerm, projects]);
  
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
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by address..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Current Step</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                  {projects.length === 0 ? "No projects found" : "No matching projects found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => (
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
                  <TableCell className="max-w-xs">
                    {project.Address ? (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0 text-slate-400" />
                        <span className="truncate">{project.Address}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{project.crm_id || project.id.substring(0, 8)}</span>
                    )}
                  </TableCell>
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
    </div>
  );
};

export default ProjectSelector;
