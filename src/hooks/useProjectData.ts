
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useProjectData = (
  companyId: string | undefined,
  userId: string | undefined,
  onlyShowMyProjects: boolean,
  projectManagerFilter: string | null
) => {
  const [projectsData, setProjectsData] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProjects = async () => {
      if (!companyId) {
        setProjectsData([]);
        return;
      }

      try {
        let query = supabase
          .from('projects')
          .select('*')
          .eq('company_id', companyId);

        if (onlyShowMyProjects && userId) {
          query = query.eq('project_manager', userId);
        } else if (projectManagerFilter) {
          query = query.eq('project_manager', projectManagerFilter);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        setProjectsData(data || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch project data",
        });
        setProjectsData([]);
      }
    };

    fetchProjects();
  }, [companyId, userId, onlyShowMyProjects, projectManagerFilter]);

  return projectsData;
};

