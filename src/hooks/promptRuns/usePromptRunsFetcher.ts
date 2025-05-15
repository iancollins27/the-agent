
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
          projects:project_id (crm_id, Address, next_step, company_id),
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
        // Get unique company IDs to fetch company base URLs
        const companyIds = new Set<string>();
        data.forEach(run => {
          if (run.projects && 'company_id' in run.projects) {
            companyIds.add(run.projects.company_id);
          }
        });
        
        // Fetch company base URLs
        const companyUrlMap = await fetchCompanyBaseUrls(Array.from(companyIds));
        
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
          
          // Generate a CRM URL if we have project data
          let crmUrl = null;
          if (projectId && project && 'crm_id' in project && 'company_id' in project) {
            const companyId = project.company_id;
            const baseUrl = companyUrlMap.get(companyId) || '';
            if (baseUrl) {
              crmUrl = `${baseUrl}${project.crm_id}`;
            }
          }
          
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
            // Use the address as the primary display and hide CRM ID
            project_name: null, // Don't show CRM ID
            project_address: project && 'Address' in project ? String(project.Address) : null,
            project_next_step: project && 'next_step' in project ? String(project.next_step) : null,
            project_crm_url: crmUrl,
            project_roofer_contact: rooferContact,
            roofer_contact: rooferContact, // For compatibility
            project_manager: null, // Will be set later if needed
            workflow_type: workflowPrompt && 'type' in workflowPrompt ? String(workflowPrompt.type) : null, // Use workflow_prompt.type instead of run.workflow_prompt_type
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

  // Fetch the base URLs for all companies
  const fetchCompanyBaseUrls = async (companyIds: string[]): Promise<Map<string, string>> => {
    const companyUrlMap = new Map<string, string>();
    
    if (companyIds.length > 0) {
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, company_project_base_URL')
        .in('id', companyIds);
      
      if (!companiesError && companiesData) {
        companiesData.forEach(company => {
          if (company.company_project_base_URL) {
            // Ensure the base URL ends with a slash if it doesn't already
            const baseUrl = company.company_project_base_URL.endsWith('/') 
              ? company.company_project_base_URL 
              : `${company.company_project_base_URL}/`;
            
            companyUrlMap.set(company.id, baseUrl);
          }
        });
      } else {
        console.error("Error fetching company base URLs:", companiesError);
      }
    }
    
    return companyUrlMap;
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
