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
    console.log("Starting send-communication function execution");
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body
    const requestData: SendCommRequest = await req.json();
    
    // Log the full request payload
    console.log("==== FULL REQUEST PAYLOAD ====");
    console.log(JSON.stringify(requestData, null, 2));
    console.log("=============================");
    
    const { 
      actionId,
      messageContent,
      recipient,
      sender,      // This should now be properly included in the request
      channel,
      providerId,
      projectId,
      companyId,
      isTest,
      senderId     // For backward-compat or fallback
    } = requestData;

    console.log(`Processing communication request${actionId ? ` for action ID: ${actionId}` : ''}`);
    console.log(`Recipient details:`, recipient);
    console.log(`Sender details:`, sender);
    console.log(`Channel: ${channel}, Requested provider ID: ${providerId || 'not specified'}`);
    
    // ----- HANDLE SENDER INFORMATION -----
    // If the incoming request has a sender object, start with that.
    // If only a senderId is passed, fall back to that.
    let senderInfo = { ...sender } || {};
    if (!senderInfo.id && senderId) {
      senderInfo.id = senderId;
    }

    // If we have a sender.id but are missing phone/email/name, fetch from 'contacts'
    if (senderInfo && senderInfo.id && (!senderInfo.phone || !senderInfo.email || !senderInfo.name)) {
      console.log(`Looking up sender with ID: ${senderInfo.id}`);
      const { data: senderData, error: senderError } = await supabase
        .from('contacts')
        .select('id, full_name, phone_number, email')
        .eq('id', senderInfo.id)
        .single();

      if (senderError) {
        console.log(`Error fetching sender contact: ${senderError.message}`);
      } else if (senderData) {
        console.log(`Sender contact found:`, senderData);
        senderInfo.name = senderInfo.name || senderData.full_name;
        senderInfo.phone = senderInfo.phone || senderData.phone_number;
        senderInfo.email = senderInfo.email || senderData.email;
      }
    }

    // ----- HANDLE RECIPIENT INFORMATION -----
    // This logic matches what you already have, just left intact
    let recipientInfo = { ...recipient };

    // If recipient has an ID but missing other details, fetch them
    if (recipientInfo.id && (!recipientInfo.phone || !recipientInfo.email || !recipientInfo.name)) {
      console.log(`Looking up recipient with ID: ${recipientInfo.id}`);
      const { data: recipientData, error: recipientError } = await supabase
        .from('contacts')
        .select('id, full_name, phone_number, email')
        .eq('id', recipientInfo.id)
        .single();

      if (recipientError) {
        console.log(`Error fetching recipient: ${recipientError.message}`);
      } else if (recipientData) {
        console.log(`Recipient contact found:`, recipientData);
        // Update recipient info with data from contacts table
        recipientInfo.name = recipientInfo.name || recipientData.full_name;
        recipientInfo.phone = recipientInfo.phone || recipientData.phone_number;
        recipientInfo.email = recipientInfo.email || recipientData.email;
      }
    }

    // Log the final recipient and sender objects
    console.log('Final recipient information:', recipientInfo);
    console.log('Final sender information:', senderInfo);

    // Determine company ID
    const targetCompanyId = await determineCompanyId(supabase, companyId, projectId);

    // Determine provider info
    const providerInfo = await getProviderInfo(
      supabase, 
      providerId, 
      targetCompanyId, 
      channel, 
      actionId, 
      req.headers.get('x-real-ip') || 'unknown'
    );

    // Validate required fields
    if (!messageContent) {
      throw new Error('Message content is required');
    }

    if (channel === 'sms' && !recipientInfo.phone) {
      throw new Error('Phone number is required for SMS communications');
    }

    if (channel === 'email' && !recipientInfo.email) {
      throw new Error('Email address is required for email communications');
    }

    console.log(`Using communication provider: ${providerInfo.provider_name}`);

    // Record in communications table
    let commRecord;
    try {
      commRecord = await createCommunicationRecord(
        supabase,
        {
          projectId,
          channel,
          messageContent,
          recipient: recipientInfo,
          sender: senderInfo,
          providerInfo
        }
      );
    } catch (commError) {
      console.error(`Communication record creation failed: ${commError.message}`);
      throw commError;
    }

    // Update action record with the communication ID
    if (actionId) {
      await updateActionRecord(supabase, actionId, commRecord.id, providerInfo.provider_name);
    }

    // If this is just a test, we skip sending
    if (isTest) {
      console.log('Test mode - skipping actual communication send');
      await supabase
        .from('communications')
        .update({
          status: 'TEST',
          sent_at: new Date().toISOString(),
          provider_response: { test: true }
        })
        .eq('id', commRecord.id);
        
      return new Response(
        JSON.stringify({
          success: true,
          test: true,
          communication_id: commRecord.id,
          provider: providerInfo.provider_name,
          channel: channel,
          message: `Test communication recorded successfully`
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Send the actual communication
    let sendResult;
    try {
      sendResult = await sendCommunication(
        supabase, 
        providerInfo, 
        channel, 
        messageContent, 
        recipientInfo,
        senderInfo, 
        commRecord.id
      );
    } catch (sendError) {
      console.error(`Error sending communication: ${sendError.message}`);
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
    console.error(`Error stack: ${error.stack || 'No stack trace available'}`);
    
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
