
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { parseJustCallWebhook } from "./parsers/justcall.ts";
import { parseTwilioWebhook } from "./parsers/twilio.ts";

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
    } catch (error) {
      console.error("Error parsing request body:", error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { webhookId, service } = requestBody;

    if (!webhookId || !service) {
      return new Response(
        JSON.stringify({ error: 'Missing webhookId or service' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Normalizing ${service} webhook with ID: ${webhookId}`);

    // Fetch the raw webhook from database
    const { data: webhook, error: fetchError } = await supabase
      .from('raw_comms_webhooks')
      .select('*')
      .eq('id', webhookId)
      .single();

    if (fetchError || !webhook) {
      console.error('Error fetching webhook:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Webhook not found', details: fetchError }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing webhook ${webhookId} with raw payload:`, JSON.stringify(webhook.raw_payload, null, 2).substring(0, 1000));

    // Parse the webhook based on service
    let normalizedData;
    
    try {
      switch (service) {
        case 'justcall':
          normalizedData = parseJustCallWebhook(webhook.raw_payload);
          break;
        case 'twilio':
          normalizedData = parseTwilioWebhook(webhook.raw_payload);
          break;
        default:
          throw new Error(`Unsupported service: ${service}`);
      }
      
      console.log('Normalized data:', JSON.stringify(normalizedData, null, 2));

      // Validate the normalized data structure
      if (!normalizedData.type || !normalizedData.subtype || !normalizedData.participants || !normalizedData.timestamp || !normalizedData.direction) {
        throw new Error(`Invalid normalized data structure: ${JSON.stringify(normalizedData)}`);
      }

      // Save normalized data to communications table
      const { data: communication, error: insertError } = await supabase
        .from('communications')
        .insert({
          raw_webhook_id: webhook.id,
          type: normalizedData.type,
          subtype: normalizedData.subtype,
          participants: normalizedData.participants,
          timestamp: normalizedData.timestamp,
          direction: normalizedData.direction,
          duration: normalizedData.duration,
          content: normalizedData.content,
          recording_url: normalizedData.recording_url,
          project_id: normalizedData.project_id
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving communication:', insertError);
        throw insertError;
      }

      console.log('Saved communication with ID:', communication.id);

      // Mark the webhook as processed
      await supabase
        .from('raw_comms_webhooks')
        .update({ processed: true })
        .eq('id', webhook.id);

      // Call the business logic handler with the normalized data
      try {
        const { data: businessLogicResponse, error: businessLogicError } = await supabase.functions.invoke(
          'comms-business-logic',
          {
            body: {
              communicationId: communication.id
            }
          }
        );

        if (businessLogicError) {
          console.error('Error calling business logic handler:', businessLogicError);
          // We continue even if business logic has an error
        } else {
          console.log('Business logic processed communication successfully:', businessLogicResponse);
        }
      } catch (businessError) {
        console.error('Exception in business logic handler:', businessError);
        // Continue despite business logic errors
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          communication_id: communication.id 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (parseError) {
      console.error('Error parsing webhook:', parseError);
      console.error('Error stack:', parseError.stack);
      
      // Mark the webhook as failed
      await supabase
        .from('raw_comms_webhooks')
        .update({ 
          processed: true, 
          processing_error: parseError.message 
        })
        .eq('id', webhook.id);
        
      return new Response(
        JSON.stringify({ 
          error: `Parser error: ${parseError.message}`,
          details: parseError.stack
        }),
        { 
          status: 422, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in normalizer:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
