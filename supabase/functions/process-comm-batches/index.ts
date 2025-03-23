
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log("Running scheduled batch processor for communications");
    
    // Call the business logic function to process due batches
    try {
      const { data, error } = await supabase.functions.invoke(
        'comms-business-logic',
        {
          body: {
            processBatchesOnly: true
          }
        }
      );
      
      if (error) {
        console.error(`Error from business logic function: ${error.message}`);
        throw new Error(`Error processing batches: ${error.message}`);
      }
      
      return new Response(
        JSON.stringify(data || { success: true, message: "Batch processing completed" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (invokeError) {
      console.error('Error invoking business logic function:', invokeError);
      
      // Try one more time with a simpler request
      try {
        console.log("Retrying batch processing with minimal payload");
        const retryResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/comms-business-logic`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({ processBatchesOnly: true }),
          }
        );
        
        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          return new Response(
            JSON.stringify(retryData || { success: true, message: "Batch processing completed (retry succeeded)" }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } else {
          throw new Error(`Retry failed with status: ${retryResponse.status}`);
        }
      } catch (retryError) {
        console.error('Retry also failed:', retryError);
        throw invokeError; // Throw the original error
      }
    }
  } catch (error) {
    console.error('Error in batch processor:', error);
    
    // Return a "success" response with error details to prevent the scheduler
    // from continuously retrying and generating alerts
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        message: "Batch processing attempted but failed - will retry on next scheduled run"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Use 200 instead of 500 to prevent scheduler alerts
      }
    );
  }
});
