
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./utils/headers.ts";
import { SendCommRequest, ProviderInfo } from "./types.ts";
import { determineCompanyId } from "./services/companyService.ts";
import { getProviderInfo } from "./services/providerService.ts";
import { createCommunicationRecord, updateActionRecord } from "./services/databaseService.ts";
import { sendCommunication } from "./services/communicationService.ts";

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

    // Parse request body
    const requestData: SendCommRequest = await req.json();
    const { actionId, messageContent, recipient, channel, provider, projectId, companyId } = requestData;

    console.log(`Processing communication request for action ID: ${actionId}`);
    console.log(`Recipient details:`, recipient);
    console.log(`Channel: ${channel}, Requested provider ID: ${provider || 'not specified'}`);

    // Determine company ID
    const targetCompanyId = await determineCompanyId(supabase, companyId, projectId);
    
    // Determine provider info
    const providerInfo = await getProviderInfo(
      supabase, 
      provider, 
      targetCompanyId, 
      channel, 
      actionId, 
      req.headers.get('x-real-ip') || 'unknown'
    );

    // Validate required fields
    if (!messageContent) {
      throw new Error('Message content is required');
    }

    if (channel === 'sms' && !recipient.phone) {
      throw new Error('Phone number is required for SMS communications');
    }

    if (channel === 'email' && !recipient.email) {
      throw new Error('Email address is required for email communications');
    }

    console.log(`Using communication provider: ${providerInfo.provider_name}`);

    // Record in communications table
    const commRecord = await createCommunicationRecord(
      supabase,
      {
        projectId,
        channel,
        messageContent,
        recipient,
        providerInfo
      }
    );

    // Update action record with the communication ID
    if (actionId) {
      await updateActionRecord(supabase, actionId, commRecord.id, providerInfo.provider_name);
    }

    // Send the actual communication
    let sendResult;
    try {
      sendResult = await sendCommunication(
        supabase, 
        providerInfo, 
        channel, 
        messageContent, 
        recipient, 
        commRecord.id
      );
    } catch (sendError) {
      console.error(`Error sending communication: ${sendError.message}`);
      
      // Update communication status to FAILED
      await supabase
        .from('communications')
        .update({
          status: 'FAILED',
          error_details: sendError.message
        })
        .eq('id', commRecord.id);

      throw sendError;
    }

    // Update communication status to SENT
    await supabase
      .from('communications')
      .update({
        status: 'SENT',
        sent_at: new Date().toISOString(),
        provider_response: sendResult
      })
      .eq('id', commRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        communication_id: commRecord.id,
        provider: providerInfo.provider_name,
        channel: channel,
        message: `Communication successfully sent via ${providerInfo.provider_name}`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error(`Error in send-communication function: ${error.message}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
