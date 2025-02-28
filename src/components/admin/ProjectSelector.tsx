
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Project } from "@/types/workflow";

type ProjectSelectorProps = {
  projects: Project[] | undefined;
  isLoading: boolean;
  selectedProjects: string[];
  onProjectSelectionChange: (projectId: string, checked: boolean) => void;
};

const ProjectSelector = ({
  projects,
  isLoading,
  selectedProjects,
  onProjectSelectionChange
}: ProjectSelectorProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Select</TableHead>
          <TableHead>Project ID</TableHead>
          <TableHead>Current Summary</TableHead>
          <TableHead>Project Track</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center">
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            </TableCell>
          </TableRow>
        ) : !projects?.length ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center">
              No projects found
            </TableCell>
          </TableRow>
        ) : (
          projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell>
                <Checkbox
                  checked={selectedProjects.includes(project.id)}
                  onCheckedChange={(checked) => {
                    onProjectSelectionChange(project.id, !!checked);
                  }}
                />
              </TableCell>
              <TableCell>{project.id}</TableCell>
              <TableCell className="max-w-md truncate">
                {project.summary || 'No summary'}
              </TableCell>
              <TableCell>
                {project.track_name || 'No track assigned'}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};

export default ProjectSelector;
