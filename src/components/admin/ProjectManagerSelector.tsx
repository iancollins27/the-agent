
import React, { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User } from "lucide-react";

interface ProjectManagerSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

interface ProjectManager {
  id: string;
  full_name: string;
}

const ProjectManagerSelector: React.FC<ProjectManagerSelectorProps> = ({ value, onChange }) => {
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectManagers = async () => {
      try {
        setLoading(true);
        
        // First, get all distinct project managers from the projects table
        const { data: projectManagerIds, error: idsError } = await supabase
          .from('projects')
          .select('project_manager')
          .not('project_manager', 'is', null);

        if (idsError) {
          console.error('Error fetching project managers:', idsError);
          return;
        }

        // Extract the IDs
        const managerIds = projectManagerIds
          .map(p => p.project_manager)
          .filter(Boolean);

        if (managerIds.length === 0) {
          setLoading(false);
          return;
        }

        // Then get the profile details for each manager
        const { data: managersData, error: managersError } = await supabase
          .from('profiles')
          .select('id, profile_fname, profile_lname')
          .in('id', managerIds);

        if (managersError) {
          console.error('Error fetching manager profiles:', managersError);
          return;
        }

        const formattedManagers = managersData.map(manager => ({
          id: manager.id,
          full_name: `${manager.profile_fname || ''} ${manager.profile_lname || ''}`.trim() || 'Unnamed Manager'
        }));

        setProjectManagers(formattedManagers);
      } catch (error) {
        console.error('Error in fetchProjectManagers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectManagers();
  }, []);

  return (
    <div className="min-w-[200px]">
      <Select 
        value={value || "all"} 
        onValueChange={(val) => onChange(val === "all" ? null : val)}
      >
        <SelectTrigger className="w-full">
          {loading ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Loading managers...</span>
            </div>
          ) : (
            <SelectValue placeholder="Filter by manager" />
          )}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="flex items-center">
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>All Managers</span>
            </div>
          </SelectItem>
          
          {projectManagers.map((manager) => (
            <SelectItem key={manager.id} value={manager.id} className="flex items-center">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{manager.full_name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProjectManagerSelector;
