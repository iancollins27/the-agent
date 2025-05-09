
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// CORS headers for browser support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get pending jobs
    const now = new Date().toISOString();
    const { data: jobs, error } = await supabase
      .from('integration_job_queue')
      .select('*')
      .or(`status.eq.pending,status.eq.retry`)
      .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(10);
    
    if (error) {
      throw new Error(`Failed to fetch jobs: ${error.message}`);
    }
    
    console.log(`Found ${jobs?.length || 0} jobs to process`);
    
    // Process each job
    const results = [];
    for (const job of jobs || []) {
      try {
        console.log(`Processing job ${job.id} - ${job.operation_type} ${job.resource_type}`);
        
        // Update job to in_progress
        await supabase
          .from('integration_job_queue')
          .update({ status: 'in_progress' })
          .eq('id', job.id);
          
        // Handle the job based on operation type
        if (job.operation_type === 'read') {
          // Call data-fetch function
          const fetchResponse = await supabase.functions.invoke('data-fetch', {
            body: {
              companyId: job.company_id,
              resourceType: job.resource_type,
              ...job.payload
            }
          });
          
          // Update job with result
          const jobResult = fetchResponse.data?.data || fetchResponse.data;
          await supabase
            .from('integration_job_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
              result: jobResult
            })
            .eq('id', job.id);
            
          results.push({ id: job.id, success: true });
        } else if (job.operation_type === 'write' || job.operation_type === 'delete') {
          // Call data-push function
          const pushResponse = await supabase.functions.invoke('data-push', {
            body: {
              companyId: job.company_id,
              ...job.payload,
              jobId: job.id
            }
          });
          
          if (!pushResponse.data?.success) {
            throw new Error(pushResponse.data?.error || "Data push operation failed");
          }
          
          results.push({ id: job.id, success: true });
        } else {
          // Unsupported operation
          throw new Error(`Unsupported operation type: ${job.operation_type}`);
        }
      } catch (jobError) {
        console.error(`Error processing job ${job.id}:`, jobError);
        
        // Increment retry count and set next retry time
        const retryCount = (job.retry_count || 0) + 1;
        const maxRetries = 5;
        
        if (retryCount <= maxRetries) {
          // Exponential backoff for retries
          const backoffMinutes = Math.min(2 ** (retryCount - 1), 60);
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);
          
          await supabase
            .from('integration_job_queue')
            .update({
              status: 'retry',
              retry_count: retryCount,
              next_retry_at: nextRetry.toISOString(),
              error_message: jobError.message || "Unknown error"
            })
            .eq('id', job.id);
        } else {
          // Max retries reached, mark as failed
          await supabase
            .from('integration_job_queue')
            .update({
              status: 'failed',
              processed_at: new Date().toISOString(),
              error_message: `Max retries (${maxRetries}) reached. Last error: ${jobError.message || "Unknown error"}`
            })
            .eq('id', job.id);
        }
        
        results.push({ id: job.id, success: false, error: jobError.message });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error processing integration jobs:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "An unexpected error occurred" 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
