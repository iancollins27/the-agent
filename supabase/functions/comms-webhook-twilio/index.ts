
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

    // Parse form data from Twilio (they send application/x-www-form-urlencoded)
    let requestBody = {};
    
    if (req.headers.get('content-type')?.includes('application/json')) {
      requestBody = await req.json();
    } else {
      // Handle form-urlencoded data
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        requestBody[key] = value;
      }
    }
    
    console.log('Received Twilio webhook:', JSON.stringify(requestBody, null, 2));

    // TODO: Implement Twilio signature validation
    // https://www.twilio.com/docs/usage/webhooks/webhooks-security

    // Save raw webhook to database
    const { data: savedWebhook, error: saveError } = await supabase
      .from('raw_comms_webhooks')
      .insert({
        service_name: 'twilio',
        webhook_id: requestBody.CallSid || requestBody.MessageSid || requestBody.SmsSid,
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
          service: 'twilio'
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

    // Respond with TwiML or JSON depending on the request
    if (req.headers.get('accept')?.includes('application/xml') || 
        req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/xml' 
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, webhook_id: savedWebhook.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing Twilio webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
