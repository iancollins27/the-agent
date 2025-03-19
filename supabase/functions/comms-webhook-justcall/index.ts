
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

    // Get request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Received JustCall webhook:', JSON.stringify(requestBody, null, 2));
    } catch (error) {
      console.error('Error parsing webhook payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // TODO: Implement JustCall signature validation if they provide one
    // For now, we'll log the webhook and pass it to the normalizer

    // Save raw webhook to database
    const { data: savedWebhook, error: saveError } = await supabase
      .from('raw_comms_webhooks')
      .insert({
        service_name: 'justcall',
        webhook_id: requestBody.webhook_id || requestBody.call_id || requestBody.message_id,
        raw_payload: requestBody,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving webhook:', saveError);
      throw saveError;
    }

    console.log('Saved webhook with ID:', savedWebhook.id);

    // Call the normalizer function with the webhook ID
    const { data: normalizerResponse, error: normalizerError } = await supabase.functions.invoke(
      'comms-webhook-normalizer',
      {
        body: {
          webhookId: savedWebhook.id,
          service: 'justcall'
        }
      }
    );

    if (normalizerError) {
      console.error('Error calling normalizer:', normalizerError);
      // We don't want to fail the webhook if normalization fails
      // Just log it and return success to the webhook sender
    } else {
      console.log('Normalizer processed webhook successfully:', normalizerResponse);
    }

    return new Response(
      JSON.stringify({ success: true, webhook_id: savedWebhook.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing JustCall webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
