
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { PromptRun } from '../types';
import { getPromptRunsWithPendingActions } from '@/utils/promptRunQueries';

interface PromptRunDbResult extends Record<string, any> {
  roofer_contact?: string | null;
  pending_actions: number;
}

export const usePromptRunData = (statusFilter: string | null) => {
  const [promptRuns, setPromptRuns] = useState<PromptRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPromptRuns = async () => {
    setLoading(true);
    try {
      // Get prompt runs with pending actions
      const runsWithPending = await getPromptRunsWithPendingActions();
      
      if (runsWithPending && runsWithPending.length > 0) {
        const projectIds = runsWithPending.map(run => run.project_id).filter(Boolean);
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
              if (item.contacts && item.contacts.role === 'Roofer') {
                rooferContactMap.set(item.project_id, item.contacts.full_name);
              }
            });
          } else {
            console.error("Error fetching roofer contacts:", contactsError);
          }
        }
        
        // Cast data to our extended type and include pending_actions count
        const dataWithRoofer = runsWithPending as PromptRunDbResult[];
        
        // Format data to include project, workflow information and properly cast to PromptRun type
        const formattedData = dataWithRoofer.map(run => {
          const projectId = run.project_id;
          const rooferContact = projectId ? rooferContactMap.get(projectId) : null;
          
          return {
            ...run,
            project_name: run.projects?.crm_id || 'Unknown Project',
            project_address: run.projects?.Address || null,
            project_roofer_contact: rooferContact || null,
            workflow_prompt_type: run.workflow_prompts?.type || 'Unknown Type',
            workflow_type: run.workflow_prompts?.type,
            prompt_text: run.prompt_input,
            result: run.prompt_output,
            reviewed: run.reviewed === true,
            pending_actions: run.pending_actions || 0
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
