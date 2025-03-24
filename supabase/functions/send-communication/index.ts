
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define communication provider types
type CommProvider = 'justcall' | 'twilio' | 'sendgrid' | 'none';

// Interface for our request payload
interface SendCommRequest {
  actionId: string;
  messageContent: string;
  recipient: {
    id?: string;
    phone?: string;
    email?: string;
    name?: string;
  };
  channel: 'sms' | 'email' | 'call';
  provider?: CommProvider;
  projectId?: string;
  companyId?: string;
}

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
    console.log(`Channel: ${channel}, Requested provider: ${provider || 'not specified'}`);

    // If no provider specified, determine company's default provider
    let commProvider = provider;
    if (!commProvider && companyId) {
      console.log(`No provider specified, fetching default provider for company ${companyId}`);
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('communication_settings')
        .eq('id', companyId)
        .single();

      if (companyError) {
        console.error(`Error fetching company: ${companyError.message}`);
      } else if (companyData?.communication_settings) {
        // Extract the default provider for the channel from company settings
        const commSettings = companyData.communication_settings as Record<string, any>;
        commProvider = commSettings[`default_${channel}_provider`] as CommProvider || 'none';
        console.log(`Using company's default ${channel} provider: ${commProvider}`);
      }
    }

    // If still no provider, fallback to justcall for SMS and calls, sendgrid for email
    if (!commProvider || commProvider === 'none') {
      console.log('No provider found in company settings, using default fallback');
      commProvider = channel === 'email' ? 'sendgrid' : 'justcall';
    }

    // Validate we have the minimum required details
    if (!messageContent) {
      throw new Error('Message content is required');
    }

    if (channel === 'sms' && !recipient.phone) {
      throw new Error('Phone number is required for SMS communications');
    }

    if (channel === 'email' && !recipient.email) {
      throw new Error('Email address is required for email communications');
    }

    console.log(`Using communication provider: ${commProvider}`);

    // Record in communications table
    const { data: commRecord, error: commError } = await supabase
      .from('communications')
      .insert({
        project_id: projectId,
        type: channel.toUpperCase(),
        direction: 'OUTBOUND',
        content: messageContent,
        timestamp: new Date().toISOString(),
        participants: [
          {
            type: 'recipient',
            contact_id: recipient.id,
            name: recipient.name,
            phone: recipient.phone,
            email: recipient.email
          }
        ],
        provider: commProvider,
        status: 'PENDING'
      })
      .select()
      .single();

    if (commError) {
      console.error(`Error creating communication record: ${commError.message}`);
      throw new Error(`Failed to create communication record: ${commError.message}`);
    }

    // Update action record with the communication ID
    if (actionId) {
      const { error: actionUpdateError } = await supabase
        .from('action_records')
        .update({
          execution_result: {
            status: 'comm_initiated',
            timestamp: new Date().toISOString(),
            communication_id: commRecord.id,
            provider: commProvider,
            details: `Communication initiated via ${commProvider}`
          }
        })
        .eq('id', actionId);

      if (actionUpdateError) {
        console.error(`Error updating action record: ${actionUpdateError.message}`);
      }
    }

    // Send the actual communication based on provider and channel
    let sendResult;
    try {
      sendResult = await sendCommunication(supabase, commProvider, channel, messageContent, recipient, commRecord.id);
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
        provider: commProvider,
        channel: channel,
        message: `Communication successfully sent via ${commProvider}`
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

// Function to send communication based on provider and channel
async function sendCommunication(
  supabase: any,
  provider: CommProvider,
  channel: string,
  message: string,
  recipient: any,
  communicationId: string
): Promise<any> {
  console.log(`Sending ${channel} via ${provider} to ${recipient.phone || recipient.email}`);

  // Actual implementation based on provider
  switch (provider) {
    case 'justcall':
      return await sendViaJustCall(channel, message, recipient);
    case 'twilio':
      return await sendViaTwilio(channel, message, recipient);
    case 'sendgrid':
      return await sendViaSendGrid(message, recipient);
    default:
      // For now, simulate success for testing
      console.log('Using mock provider - in production, this would send a real message');
      return {
        mock: true,
        status: 'sent',
        provider_message_id: `mock-${Date.now()}`
      };
  }
}

// Implementation for JustCall (placeholder - would need JustCall API integration)
async function sendViaJustCall(channel: string, message: string, recipient: any): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending via JustCall: ${channel} to ${recipient.phone}`);
  return {
    provider: 'justcall',
    status: 'sent',
    provider_message_id: `justcall-${Date.now()}`
  };
}

// Implementation for Twilio (placeholder - would need Twilio API integration)
async function sendViaTwilio(channel: string, message: string, recipient: any): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending via Twilio: ${channel} to ${recipient.phone}`);
  return {
    provider: 'twilio',
    status: 'sent',
    provider_message_id: `twilio-${Date.now()}`
  };
}

// Implementation for SendGrid (placeholder - would need SendGrid API integration)
async function sendViaSendGrid(message: string, recipient: any): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending email via SendGrid to ${recipient.email}`);
  return {
    provider: 'sendgrid',
    status: 'sent',
    provider_message_id: `sendgrid-${Date.now()}`
  };
}
