
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../types';

export const usePromptRunData = (statusFilter: string | null) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPromptRuns = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (crm_id, Address),
          workflow_prompts:workflow_prompt_id (type)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      // Get all project IDs to fetch roofer contacts
      if (data && data.length > 0) {
        const projectIds = data.map(run => run.project_id).filter(Boolean);
        const uniqueProjectIds = [...new Set(projectIds)];
        
        // Get roofer contacts for each project
        const rooferContactMap = new Map();
        
        if (uniqueProjectIds.length > 0) {
          const { data: contactsData, error: contactsError } = await supabase
            .from('project_contacts')
            .select(`
              project_id,
              contacts:contact_id (
                id, full_name, role
              )
            `)
            .in('project_id', uniqueProjectIds);
          
          if (!contactsError && contactsData) {
            contactsData.forEach(item => {
              if (item.contacts && item.contacts.role === 'roofer') {
                rooferContactMap.set(item.project_id, item.contacts.full_name);
              }
            });
          } else {
            console.error("Error fetching roofer contacts:", contactsError);
          }
        }
        
        // Format data to include project, workflow information and properly cast to PromptRun type
        const formattedData = data.map(run => {
          const projectId = run.project_id;
          const rooferContact = projectId ? rooferContactMap.get(projectId) : null;
          
          return {
            ...run,
            project_name: run.projects?.crm_id || 'Unknown Project',
            project_address: run.projects?.Address || null,
            project_roofer_contact: rooferContact || null,
            workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
            // Make sure it matches our PromptRun type
            workflow_type: run.workflow_prompts?.type,
            prompt_text: run.prompt_input,
            result: run.prompt_output,
            reviewed: run.reviewed === true // Convert to boolean, handle null/undefined
          } as PromptRun;
        });

        setPromptRuns(formattedData);
      } else {
        setPromptRuns([]);
      }
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch prompt runs when component mounts or statusFilter changes
  useEffect(() => {
    fetchPromptRuns();
  }, [statusFilter]);

  return {
    promptRuns,
    setPromptRuns,
    loading,
    fetchPromptRuns
  };
};
