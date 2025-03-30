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

    // Check communications table structure for debugging purposes
    try {
      console.log("Checking communications table schema...");
      const { error: descError } = await supabase.rpc('get_table_info', { 
        table_name: 'communications' 
      });
      
      if (descError) {
        console.log(`Could not get table info: ${descError.message}`);
      }
    } catch (e) {
      console.log(`Exception checking table schema: ${e.message}`);
    }

    // Parse request body
    const requestData: SendCommRequest = await req.json();
    const { 
      actionId, 
      messageContent, 
      recipient, 
      sender: explicitSender, // New explicit sender field
      channel, 
      providerId, 
      projectId, 
      companyId, 
      isTest,
      senderId 
    } = requestData;

    console.log(`Processing communication request${actionId ? ` for action ID: ${actionId}` : ''}`);
    console.log(`Recipient details:`, recipient);
    console.log(`Channel: ${channel}, Requested provider ID: ${providerId || 'not specified'}`);
    
    // ----- HANDLE SENDER INFORMATION -----
    // Determine the sender information from available sources 
    let senderInfo = explicitSender ? { ...explicitSender } : {};
    
    // Try to get the sender information using the explicit senderId or from legacy fields
    const effectiveSenderId = senderId || (recipient.sender_ID ? recipient.sender_ID : null);
    
    console.log(`Effective sender ID determined: ${effectiveSenderId || 'None provided'}`);

    if (effectiveSenderId && !explicitSender) {
      console.log(`Looking up sender contact with ID: ${effectiveSenderId}`);
      
      const { data: senderData, error: senderError } = await supabase
        .from('contacts')
        .select('id, full_name, phone_number, email')
        .eq('id', effectiveSenderId)
        .single();
        
      if (senderError) {
        console.log(`Error fetching sender contact: ${senderError.message}`);
      } else if (senderData) {
        console.log(`Sender contact found:`, senderData);
        console.log(`Sender phone number from contact: ${senderData.phone_number}`);
        
        // Set the sender information
        senderInfo = {
          id: senderData.id,
          name: senderData.full_name,
          phone: senderData.phone_number,
          email: senderData.email
        };
      } else {
        console.log(`No sender contact data found for ID: ${effectiveSenderId}`);
      }
    } else if (!effectiveSenderId) {
      console.log("No sender ID provided in request or recipient object");
    }

    // ----- HANDLE RECIPIENT INFORMATION -----
    let recipientInfo = { ...recipient };
    
    // If recipient has an ID but missing other details, fetch them
    if (recipient.id && (!recipient.phone || !recipient.email || !recipient.name)) {
      console.log(`Looking up recipient with ID: ${recipient.id}`);
      
      const { data: recipientData, error: recipientError } = await supabase
        .from('contacts')
        .select('id, full_name, phone_number, email')
        .eq('id', recipient.id)
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

    // ----- BACKWARD COMPATIBILITY SUPPORT -----
    // For backward compatibility, extract sender info from legacy location in recipient object
    if (!senderInfo.phone && recipient.sender_phone) {
      console.log(`Using legacy sender_phone from recipient object: ${recipient.sender_phone}`);
      senderInfo.phone = recipient.sender_phone;
    }
    
    if (!senderInfo.phone && recipient.sender?.phone_number) {
      console.log(`Using legacy sender.phone_number from recipient object: ${recipient.sender.phone_number}`);
      senderInfo.phone = recipient.sender.phone_number;
    }
    
    if (!senderInfo.phone && recipient.sender?.phone) {
      console.log(`Using legacy sender.phone from recipient object: ${recipient.sender.phone}`);
      senderInfo.phone = recipient.sender.phone;
    }

    // Log the final recipient and sender objects
    console.log('Final recipient information:', {
      ...recipientInfo,
      // Truncate message content if present to keep logs clean
      message: recipientInfo.message ? `${recipientInfo.message.substring(0, 20)}...` : undefined
    });
    
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
      
      // Try to get more details about the error by querying the communications table schema
      try {
        const { data: columnInfo, error: columnError } = await supabase.rpc('get_column_info', {
          table_name: 'communications',
          column_name: 'direction'
        });
        
        if (columnError) {
          console.error(`Error getting column info: ${columnError.message}`);
        } else {
          console.log(`Column info for 'direction': ${JSON.stringify(columnInfo)}`);
        }
      } catch (e) {
        console.error(`Exception getting column info: ${e.message}`);
      }
      
      throw commError;
    }

    // Update action record with the communication ID
    if (actionId) {
      await updateActionRecord(supabase, actionId, commRecord.id, providerInfo.provider_name);
    }

    // If this is just a test, we can skip the actual sending
    if (isTest) {
      console.log('Test mode - skipping actual communication send');
      
      // Update communication status to TEST
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
      // Pass both recipient and sender info separately to the communication service
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
