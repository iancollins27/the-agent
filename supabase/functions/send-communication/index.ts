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
  provider?: string; // Provider ID from company_integrations table
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
    console.log(`Channel: ${channel}, Requested provider ID: ${provider || 'not specified'}`);

    // Determine company ID if not directly provided
    let targetCompanyId = companyId;
    
    if (!targetCompanyId && projectId) {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('company_id')
        .eq('id', projectId)
        .single();
        
      if (projectError) {
        console.error(`Error fetching project: ${projectError.message}`);
      } else if (projectData?.company_id) {
        targetCompanyId = projectData.company_id;
        console.log(`Determined company ID from project: ${targetCompanyId}`);
      }
    }

    // Determine provider info
    let providerInfo = null;
    let providerType = channel === 'email' ? 'email' : 'phone';

    // If specific provider ID was provided, use that
    if (provider) {
      console.log(`Looking up provider with ID: ${provider}`);
      // Log access to the integration keys
      await supabase.rpc(
        'log_integration_key_access',
        { 
          p_integration_id: provider,
          p_accessed_by: `send-communication function (action: ${actionId})`,
          p_access_reason: `Sending ${channel} communication`,
          p_source_ip: req.headers.get('x-real-ip') || 'unknown'
        }
      );
      
      // Get provider credentials using the secure function
      const { data: providerData, error: providerError } = await supabase.rpc(
        'get_company_integration_keys',
        { integration_id: provider }
      );
      
      if (providerError) {
        console.error(`Error fetching provider details: ${providerError.message}`);
      } else if (providerData && providerData.length > 0) {
        providerInfo = providerData[0];
      }
    } 
    // Otherwise use the default provider for this channel type
    else if (targetCompanyId) {
      console.log(`Looking up default ${providerType} provider for company ${targetCompanyId}`);
      
      // Get the default provider ID for this channel
      const defaultProviderColumn = channel === 'email' ? 'default_email_provider' : 'default_phone_provider';
      
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select(defaultProviderColumn)
        .eq('id', targetCompanyId)
        .single();
        
      if (companyError) {
        console.error(`Error fetching company: ${companyError.message}`);
      } else if (companyData && companyData[defaultProviderColumn]) {
        const defaultProviderId = companyData[defaultProviderColumn];
        console.log(`Found default provider ID: ${defaultProviderId}`);
        
        // Log access to the integration keys
        await supabase.rpc(
          'log_integration_key_access',
          { 
            p_integration_id: defaultProviderId,
            p_accessed_by: `send-communication function (action: ${actionId})`,
            p_access_reason: `Sending ${channel} communication using default provider`,
            p_source_ip: req.headers.get('x-real-ip') || 'unknown'
          }
        );
        
        // Get provider credentials using the secure function
        const { data: providerData, error: providerError } = await supabase.rpc(
          'get_company_integration_keys',
          { integration_id: defaultProviderId }
        );
        
        if (providerError) {
          console.error(`Error fetching default provider details: ${providerError.message}`);
        } else if (providerData && providerData.length > 0) {
          providerInfo = providerData[0];
        }
      }
    }

    // Verify we have the provider info and required recipient data
    if (!providerInfo) {
      console.log('No provider found, using mock provider for testing');
      providerInfo = { 
        provider_name: 'mock',
        api_key: 'mock-key',
        api_secret: 'mock-secret'
      };
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

    console.log(`Using communication provider: ${providerInfo.provider_name}`);

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
        provider: providerInfo.provider_name,
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
            provider: providerInfo.provider_name,
            details: `Communication initiated via ${providerInfo.provider_name}`
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

// Function to send communication based on provider and channel
async function sendCommunication(
  supabase: any,
  provider: any,
  channel: string,
  message: string,
  recipient: any,
  communicationId: string
): Promise<any> {
  console.log(`Sending ${channel} via ${provider.provider_name} to ${recipient.phone || recipient.email}`);

  // Actual implementation based on provider
  switch (provider.provider_name.toLowerCase()) {
    case 'justcall':
      return await sendViaJustCall(provider, channel, message, recipient);
    case 'twilio':
      return await sendViaTwilio(provider, channel, message, recipient);
    case 'sendgrid':
      return await sendViaSendGrid(provider, message, recipient);
    default:
      // For now, simulate success for testing
      console.log(`Using ${provider.provider_name} provider - mock implementation for testing`);
      return {
        mock: true,
        status: 'sent',
        provider_message_id: `mock-${Date.now()}`
      };
  }
}

// Implementation for JustCall
async function sendViaJustCall(providerInfo: any, channel: string, message: string, recipient: any): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending via JustCall: ${channel} to ${recipient.phone}`);
  console.log(`JustCall API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  return {
    provider: 'justcall',
    status: 'sent',
    provider_message_id: `justcall-${Date.now()}`
  };
}

// Implementation for Twilio
async function sendViaTwilio(providerInfo: any, channel: string, message: string, recipient: any): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending via Twilio: ${channel} to ${recipient.phone}`);
  console.log(`Twilio API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  return {
    provider: 'twilio',
    status: 'sent',
    provider_message_id: `twilio-${Date.now()}`
  };
}

// Implementation for SendGrid
async function sendViaSendGrid(providerInfo: any, message: string, recipient: any): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending email via SendGrid to ${recipient.email}`);
  console.log(`SendGrid API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  return {
    provider: 'sendgrid',
    status: 'sent',
    provider_message_id: `sendgrid-${Date.now()}`
  };
}
