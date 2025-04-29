
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

// Retry configuration
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

// Smaller batch sizes to prevent resource exhaustion
const BATCH_SIZE = 5; // Reduced from 10

export const usePromptRunsFetcher = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  // Helper function to add delay between retries
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Function with retry logic
  const withRetry = async <T>(fn: () => Promise<T>, attempts = RETRY_ATTEMPTS): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      if (attempts <= 1) throw error;
      
      console.log(`Retrying operation after error: ${error.message}, attempts left: ${attempts-1}`);
      await wait(RETRY_DELAY);
      return withRetry(fn, attempts - 1);
    }
  };
  
  // Function to fetch a single page of prompt runs with count
  const fetchPromptRunsPage = async (
    statusFilter: string | null,
    page: number = 0,
    pageSize: number = 5, // Reduced from 10
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
        try {
          const countResult = await withRetry(async () => {
            const countQuery = supabase
              .from('prompt_runs')
              .select('id', { count: 'exact', head: true });
              
            if (statusFilter) {
              countQuery.eq('status', statusFilter);
            }
            
            return await countQuery;
          });
          
          const { count, error: countError } = countResult;
          
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
        } catch (err: any) {
          console.error("Error fetching count:", err);
          return {
            data: [],
            count: null,
            hasMore: false,
            error: `Failed to count: ${err.message}`
          };
        }
      }
      
      // Build our main data query with retry logic
      try {
        const result = await withRetry(async () => {
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
  
          return await query;
        });
        
        const { data, error, count } = result;

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
      } catch (err: any) {
        console.error('Error fetching prompt runs:', err);
        toast({
          variant: "destructive",
          title: "Error loading data",
          description: "Failed to fetch prompt runs. Try reducing filters or loading fewer items."
        });
        return {
          data: [],
          count: null,
          hasMore: false,
          error: err?.message || 'An unknown error occurred while fetching prompt runs'
        };
      }
    } catch (error: any) {
      console.error('Error in fetchPromptRunsPage:', error);
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

  // Function to fetch roofer contacts in batches with retry
  const fetchRooferContacts = async (projectIds: string[]) => {
    if (!projectIds.length) return new Map();
    
    try {
      const rooferContactMap = new Map();
      // Smaller batch size for performance
      const batchSize = BATCH_SIZE;
      
      // Split project IDs into smaller batches
      const batches = [];
      for (let i = 0; i < projectIds.length; i += batchSize) {
        batches.push(projectIds.slice(i, i + batchSize));
      }
      
      // Process batches with retry logic
      for (const batchIds of batches) {
        try {
          const contactResult = await withRetry(async () => {
            return await supabase
              .from('project_contacts')
              .select(`
                project_id,
                contacts:contact_id (
                  id, full_name, role
                )
              `)
              .in('project_id', batchIds);
          });
          
          const { data, error } = contactResult;
          
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
        } catch (error) {
          console.error('Error processing roofer contacts batch:', error);
          // Continue with next batch even if this one fails
        }
        
        // Add a small delay between batches to avoid resource exhaustion
        await wait(200);
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
  
  // Enhanced function to get total count of prompt runs with retry
  const getPromptRunsCount = async (statusFilter: string | null): Promise<number | null> => {
    try {
      const result = await fetchPromptRunsPage(statusFilter, 0, 1, true);
      return result.count;
    } catch (error) {
      console.error("Error getting count:", error);
      return null;
    }
  };

  return { 
    fetchPromptRunsPage, 
    fetchRooferContacts, 
    getPromptRunsCount,
    isLoading
  };
};
