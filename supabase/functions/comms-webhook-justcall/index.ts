
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-justcall-signature, x-justcall-request-timestamp',
};

// This makes the function publicly accessible without authentication
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Reject non-POST requests
  if (req.method !== 'POST') {
    console.log(`Received ${req.method} request, expected POST`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Log all headers for debugging
    const headersObj = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    console.log('Received headers:', headersObj);
    
    // Extract JustCall signature headers
    const justcallSignature = req.headers.get('x-justcall-signature');
    const justcallTimestamp = req.headers.get('x-justcall-request-timestamp');

    // Clone request to get the raw body (since we need to read it twice)
    const clonedReq = req.clone();
    const rawBody = await clonedReq.text();
    console.log('Received raw body:', rawBody.substring(0, 500) + (rawBody.length > 500 ? '...' : ''));

    // First handle verification requests (no signature headers)
    if (!justcallSignature || !justcallTimestamp) {
      console.log('Received verification request (no signature headers)');
      return new Response(
        JSON.stringify({ status: 'verification ok' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // For requests with signature headers, validate them
    console.log('Validating webhook signature...');
    
    // Check for timestamp validity (prevent replay attacks)
    const timestampMs = parseInt(justcallTimestamp);
    const currentTime = Date.now();
    const fiveMinutesMs = 5 * 60 * 1000;
    
    if (isNaN(timestampMs) || currentTime - timestampMs > fiveMinutesMs) {
      console.error('Webhook request too old or invalid timestamp', {
        timestamp: justcallTimestamp,
        currentTime,
        diff: currentTime - timestampMs
      });
      return new Response(
        JSON.stringify({ error: 'Request expired or invalid timestamp' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify the signature
    const webhookSecret = Deno.env.get('JUSTCALL_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('JUSTCALL_WEBHOOK_SECRET environment variable is not set');
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate expected signature
    const encoder = new TextEncoder();
    const message = rawBody + justcallTimestamp;
    const key = encoder.encode(webhookSecret);
    const messageEncoded = encoder.encode(message);
    
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      messageEncoded
    );
    
    const calculatedSignature = encode(signature);
    
    // Compare signatures
    if (calculatedSignature !== justcallSignature) {
      console.error('Invalid JustCall signature', {
        expected: calculatedSignature,
        received: justcallSignature
      });
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('JustCall signature verified successfully');

    // Parse the webhook body for processing
    let requestBody;
    try {
      requestBody = rawBody ? JSON.parse(rawBody) : {};
      console.log('Processed webhook payload:', JSON.stringify(requestBody, null, 2).substring(0, 500) + '...');
    } catch (error) {
      console.error('Error parsing webhook payload:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON', status: 'error' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Save raw webhook to database
    const { data: savedWebhook, error: saveError } = await supabase
      .from('raw_comms_webhooks')
      .insert({
        service_name: 'justcall',
        webhook_id: requestBody.webhook_id || requestBody.call_id || requestBody.message_id || 'verification_test',
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
      JSON.stringify({ status: 'webhook received', success: true, webhook_id: savedWebhook.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing JustCall webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error.message, status: 'error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
