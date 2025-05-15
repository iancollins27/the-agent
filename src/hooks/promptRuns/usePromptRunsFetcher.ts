
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptRunWithRoofer } from '@/utils/api/prompt-runs/types';
import { formatPromptRunData, formatRelativeTime } from '@/utils/api/prompt-runs/formatPromptRunData';

export const usePromptRunsFetcher = () => {
  const { toast } = useToast();
  
  const fetchPromptRuns = async (statusFilter: string | null): Promise<PromptRunWithRoofer[]> => {
    try {
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (crm_id, Address, next_step),
          workflow_prompts:workflow_prompt_id (id, type)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const projectIds = data.map(run => run.project_id).filter(Boolean);
        const uniqueProjectIds = [...new Set(projectIds)];
        
        // Get roofer contact information
        const rooferContactMap = await fetchRooferContacts(uniqueProjectIds);
        
        // Process each prompt run to create a full PromptRunWithRoofer object
        const processedData: PromptRunWithRoofer[] = data.map(run => {
          const project = run.projects || {};
          const workflowPrompt = run.workflow_prompts || {};
          const projectId = run.project_id;
          const rooferContact = projectId ? rooferContactMap.get(projectId) : null;
          
          return {
            id: run.id,
            created_at: run.created_at,
            status: run.status || '',
            ai_provider: run.ai_provider || '',
            ai_model: run.ai_model || '',
            prompt_input: run.prompt_input || '',
            prompt_output: run.prompt_output || '',
            error_message: run.error_message,
            feedback_rating: run.feedback_rating,
            feedback_description: run.feedback_description,
            feedback_tags: run.feedback_tags,
            feedback_review: run.feedback_review,
            completed_at: run.completed_at,
            reviewed: run.reviewed || false,
            project_id: run.project_id,
            workflow_prompt_id: run.workflow_prompt_id,
            workflow_prompt_type: workflowPrompt && 'type' in workflowPrompt ? String(workflowPrompt.type) : null,
            project_name: project && 'project_name' in project ? String(project.project_name) : null,
            project_address: project && 'Address' in project ? String(project.Address) : null,
            project_next_step: project && 'next_step' in project ? String(project.next_step) : null,
            project_crm_url: null, // Will be set later if needed
            project_roofer_contact: rooferContact,
            roofer_contact: rooferContact, // For compatibility
            project_manager: null, // Will be set later if needed
            workflow_type: null, // No workflow_type in schema
            error: !!run.error_message,
            relative_time: formatRelativeTime(run.created_at),
            toolLogsCount: 0 // Default value
          };
        });
        
        return processedData;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching prompt runs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load prompt runs data",
      });
      return [];
    }
  };

  const fetchRooferContacts = async (projectIds: string[]): Promise<Map<string, string>> => {
    const rooferContactMap = new Map<string, string>();
    
    if (projectIds.length > 0) {
      const { data: contactsData, error: contactsError } = await supabase
        .from('project_contacts')
        .select(`
          project_id,
          contacts:contact_id (
            id, full_name, role
          )
        `)
        .in('project_id', projectIds);
      
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
    
    return rooferContactMap;
  };

  return { fetchPromptRuns };
};
