
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
          projects:project_id (
            crm_id, 
            Address,
            company_id,
            project_manager (
              id,
              profile_fname,
              profile_lname
            )
          ),
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

      if (data) {
        // Fetch company information for CRM URLs
        const companyIds = data
          .map(run => run.projects?.company_id)
          .filter(Boolean);
        
        const uniqueCompanyIds = [...new Set(companyIds)];
        const companyBaseUrls = new Map();
        
        if (uniqueCompanyIds.length > 0) {
          const { data: companies, error: companiesError } = await supabase
            .from('companies')
            .select('id, company_project_base_URL')
            .in('id', uniqueCompanyIds);
            
          if (!companiesError && companies) {
            companies.forEach(company => {
              if (company.company_project_base_URL) {
                companyBaseUrls.set(company.id, company.company_project_base_URL);
              }
            });
          }
        }

        const formattedData = data.map(run => {
          const projectData = run.projects;
          const companyId = projectData?.company_id;
          const crmId = projectData?.crm_id;
          
          // Build the CRM URL if we have both a base URL and a CRM ID
          let projectCrmUrl = null;
          if (companyId && crmId && companyBaseUrls.has(companyId)) {
            projectCrmUrl = `${companyBaseUrls.get(companyId)}${crmId}`;
          }
          
          return {
            ...run,
            id: run.id,
            created_at: run.created_at,
            project_name: projectData?.crm_id || 'Unknown Project',
            project_address: projectData?.Address || null,
            project_crm_url: projectCrmUrl,
            project_manager: projectData?.project_manager ? 
              `${projectData.project_manager.profile_fname || ''} ${projectData.project_manager.profile_lname || ''}`.trim() || 'Unnamed Manager' 
              : null,
            workflow_type: run.workflow_prompts?.type || null,
            workflow_prompt_type: run.workflow_prompts?.type || null,
            prompt_text: run.prompt_input,
            result: run.prompt_output,
            reviewed: run.reviewed === true
          }}) as PromptRun[];

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
