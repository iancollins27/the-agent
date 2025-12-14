
import { ProviderInfo } from "../types.ts";

/**
 * Get the company's agent phone number for outbound agent communications
 */
async function getCompanyAgentPhone(supabase: any, companyId: string): Promise<string | null> {
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('agent_phone_number')
      .eq('id', companyId)
      .single();
    
    if (error || !company?.agent_phone_number) {
      console.log(`No agent phone number configured for company ${companyId}`);
      return null;
    }
    
    console.log(`Found agent phone number for company ${companyId}: ${company.agent_phone_number}`);
    return company.agent_phone_number;
  } catch (error) {
    console.error(`Error fetching company agent phone: ${error}`);
    return null;
  }
}

export async function getProviderInfo(
  supabase: any,
  providerId: string | undefined,
  companyId: string | null,
  channel: string,
  actionId: string | undefined,
  sourceIp: string,
  isAgentMessage: boolean = false
): Promise<ProviderInfo> {
  console.log(`getProviderInfo called with: {
  providerId: ${providerId || 'undefined'},
  companyId: "${companyId}",
  channel: "${channel}",
  actionId: ${actionId || 'undefined'},
  sourceIp: "${sourceIp}",
  isAgentMessage: ${isAgentMessage}
}`);

  // Handle "auto" provider selection - skip database lookup and go to auto-selection logic
  if (providerId === 'auto') {
    console.log('Auto provider selection requested - skipping provider ID lookup');
    providerId = undefined; // Treat as no specific provider requested
  }

  // For agent messages, use Twilio with the company's agent phone number
  if (isAgentMessage && channel.toLowerCase() === 'sms' && companyId) {
    console.log('Agent message detected - looking up company agent phone number');
    
    const agentPhone = await getCompanyAgentPhone(supabase, companyId);
    
    // Use system-level Twilio credentials with the company's agent phone
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (twilioAccountSid && twilioAuthToken) {
      // Use agent phone if configured, otherwise fall back to system Twilio number
      const fromPhone = agentPhone || twilioPhoneNumber;
      
      if (fromPhone) {
        console.log(`Using Twilio for agent message with from number: ${fromPhone}`);
        return {
          provider_name: 'twilio',
          api_key: twilioAccountSid,
          api_secret: twilioAuthToken,
          justcall_number: fromPhone,
          account_id: twilioAccountSid
        };
      }
    }
    
    console.warn('Agent message but no Twilio credentials or phone configured, falling through to normal logic');
  }

  // Check if this is a forced provider request (for agent responses)
  if (providerId === 'twilio' && channel.toLowerCase() === 'sms') {
    console.log('Forced Twilio provider requested - using system-level credentials');
    
    // Use system-level Twilio credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      return {
        provider_name: 'twilio',
        api_key: twilioAccountSid,
        api_secret: twilioAuthToken,
        justcall_number: twilioPhoneNumber,
        account_id: twilioAccountSid
      };
    } else {
      console.warn('System-level Twilio credentials not found, falling back to database lookup');
    }
  }

  // If a specific provider ID is requested, look it up
  if (providerId) {
    console.log(`Looking up provider with ID: ${providerId}`);
    
    const { data: provider, error } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (error) {
      console.error(`Error looking up provider ${providerId}:`, error);
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    console.log(`Provider found with ID: ${providerId}`, {
      provider_name: provider.provider_name,
      has_api_key: !!provider.api_key,
      has_api_secret: !!provider.api_secret,
      has_account_id: !!provider.account_id
    });

    return {
      provider_name: provider.provider_name,
      api_key: provider.api_key,
      api_secret: provider.api_secret,
      justcall_number: provider.justcall_number,
      account_id: provider.account_id
    };
  }

  // If no specific provider ID and we have a company, look up default provider
  if (companyId) {
    const channelType = channel.toLowerCase() === 'sms' ? 'phone' : channel.toLowerCase();
    console.log(`Looking up default ${channelType} provider for company ${companyId}`);
    
    const { data: defaultProvider, error } = await supabase
      .from('communication_providers')
      .select('*')
      .eq('company_id', companyId)
      .eq('channel_type', channelType)
      .eq('is_default', true)
      .single();

    if (!error && defaultProvider) {
      console.log(`Found default provider ID: ${defaultProvider.id}`);
      
      console.log(`Provider found with ID: ${defaultProvider.id}`, {
        provider_name: defaultProvider.provider_name,
        has_api_key: !!defaultProvider.api_key,
        has_api_secret: !!defaultProvider.api_secret,
        has_account_id: !!defaultProvider.account_id
      });

      return {
        provider_name: defaultProvider.provider_name,
        api_key: defaultProvider.api_key,
        api_secret: defaultProvider.api_secret,
        justcall_number: defaultProvider.justcall_number,
        account_id: defaultProvider.account_id
      };
    } else {
      console.log(`No default ${channelType} provider found for company ${companyId}`);
    }
  }

  // Fallback to system-level Twilio for SMS if no company provider found
  if (channel.toLowerCase() === 'sms') {
    console.log('Falling back to system-level Twilio credentials');
    
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      console.log('Using system-level Twilio credentials as fallback');
      return {
        provider_name: 'twilio',
        api_key: twilioAccountSid,
        api_secret: twilioAuthToken,
        justcall_number: twilioPhoneNumber,
        account_id: twilioAccountSid
      };
    }
  }

  throw new Error(`No communication provider configured for ${channel} channel${companyId ? ` for company ${companyId}` : ''}`);
}
