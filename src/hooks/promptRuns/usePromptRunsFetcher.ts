
import { useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PromptRun } from '@/components/admin/types';
import { formatPromptRunData } from '@/utils/api/prompt-runs';

export interface PaginatedResult<T> {
  data: T[];
  count: number | null;
  hasMore: boolean;
  error: string | null;
}

export const usePromptRunsFetcher = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Function to fetch a single page of prompt runs with count
  const fetchPromptRunsPage = async (
    statusFilter: string | null,
    page: number = 0,
    pageSize: number = 10,
    countOnly: boolean = false
  ): Promise<PaginatedResult<PromptRun>> => {
    try {
      setIsLoading(true);
      
      // Calculate range
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      console.log(`Fetching prompt runs page ${page} (range ${from}-${to})`);
      
      // If we're only requesting count, use a more efficient query
      if (countOnly) {
        const countQuery = supabase
          .from('prompt_runs')
          .select('id', { count: 'exact', head: true });
          
        if (statusFilter) {
          countQuery.eq('status', statusFilter);
        }
        
        const { count, error: countError } = await countQuery;
        
        if (countError) {
          console.error("Error counting prompt runs:", countError);
          return {
            data: [],
            count,
            hasMore: false,
            error: `Failed to count prompt runs: ${countError.message}`
          };
        }
        
        return {
          data: [],
          count,
          hasMore: count ? count > 0 : false,
          error: null
        };
      }
      
      // Build our main data query
      let query = supabase
        .from('prompt_runs')
        .select(`
          *,
          projects:project_id (
            id,
            crm_id, 
            Address,
            company_id,
            project_manager,
            next_step
          ),
          workflow_prompts:workflow_prompt_id (type)
        `, { count: 'estimated' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Error in Supabase query:", error);
        return {
          data: [],
          count,
          hasMore: false,
          error: `Failed to fetch prompt runs: ${error.message}`
        };
      }

      if (data && data.length > 0) {
        // Get formatted data
        const formattedData = formatPromptRunData(data);
        
        // Return the formatted data and pagination info
        return {
          data: formattedData,
          count,
          hasMore: data.length === pageSize,
          error: null
        };
      }
      
      return {
        data: [],
        count: 0,
        hasMore: false,
        error: null
      };
    } catch (error: any) {
      console.error('Error fetching prompt runs:', error);
      return {
        data: [],
        count: null,
        hasMore: false,
        error: error?.message || 'An unknown error occurred while fetching prompt runs'
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch roofer contacts in batches
  const fetchRooferContacts = async (projectIds: string[]) => {
    if (!projectIds.length) return new Map();
    
    try {
      const rooferContactMap = new Map();
      const BATCH_SIZE = 10; // Smaller batch size for performance
      
      // Split project IDs into smaller batches
      for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
        const batchIds = projectIds.slice(i, i + BATCH_SIZE);
        
        const { data, error } = await supabase
          .from('project_contacts')
          .select(`
            project_id,
            contacts:contact_id (
              id, full_name, role
            )
          `)
          .in('project_id', batchIds);
        
        if (error) {
          console.error('Error fetching roofer contacts batch:', error);
          continue;
        }
        
        if (data) {
          data.forEach(item => {
            if (item.contacts && item.contacts.role === 'Roofer') {
              rooferContactMap.set(item.project_id, item.contacts.full_name);
            }
          });
        }
      }
      
      return rooferContactMap;
    } catch (error) {
      console.error('Error fetching roofer contacts:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load roofer contact information",
      });
      return new Map();
    }
  };
  
  // Enhanced function to get total count of prompt runs
  const getPromptRunsCount = async (statusFilter: string | null): Promise<number | null> => {
    const result = await fetchPromptRunsPage(statusFilter, 0, 1, true);
    return result.count;
  };

  return { 
    fetchPromptRunsPage, 
    fetchRooferContacts, 
    getPromptRunsCount,
    isLoading
  };
};
