
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProjectSelectorProps = {
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
};

const ProjectSelector = ({ selectedProjectIds, setSelectedProjectIds }: ProjectSelectorProps) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [projectTracks, setProjectTracks] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      // Fetch projects with track information
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          crm_id,
          next_step,
          Address,
          project_track,
          companies(name),
          project_tracks(id, name)
        `)
        .order('id');
        
      // Fetch all project tracks for the filter dropdown
      const { data: tracksData, error: tracksError } = await supabase
        .from('project_tracks')
        .select('id, name')
        .order('name');
        
      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
      } else {
        setProjects(projectsData || []);
        setFilteredProjects(projectsData || []);
      }
      
      if (tracksError) {
        console.error('Error fetching tracks:', tracksError);
      } else {
        setProjectTracks(tracksData || []);
      }
      
      setIsLoading(false);
    };
    
    fetchData();
  }, []);
  
  useEffect(() => {
    // Filter projects when search term or track filter changes
    let filtered = projects;
    
    // Apply address search filter
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(project => 
        project.Address && project.Address.toLowerCase().includes(term)
      );
    }
    
    // Apply track filter
    if (trackFilter !== "all") {
      if (trackFilter === "no-track") {
        filtered = filtered.filter(project => !project.project_track);
      } else {
        filtered = filtered.filter(project => project.project_track === trackFilter);
      }
    }
    
    setFilteredProjects(filtered);
  }, [searchTerm, trackFilter, projects]);
  
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
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={trackFilter} onValueChange={setTrackFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by track" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tracks</SelectItem>
            <SelectItem value="no-track">No track</SelectItem>
            {projectTracks.map((track) => (
              <SelectItem key={track.id} value={track.id}>
                {track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
