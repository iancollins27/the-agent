import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ProviderInfo } from "../types.ts";

export async function getProviderInfo(
  supabase: SupabaseClient,
  providerId: string | undefined,
  companyId: string | undefined,
  channel: string,
  actionId: string | undefined,
  sourceIp: string
): Promise<ProviderInfo> {
  console.log(`getProviderInfo called with:`, {
    providerId,
    companyId,
    channel,
    actionId,
    sourceIp
  });

  let providerInfo: ProviderInfo;
  
  // If providerId is specified, use it
  if (providerId) {
    console.log(`Looking up provider with ID: ${providerId}`);
    
    providerInfo = await getProviderById(supabase, providerId, sourceIp);
  }
  // Otherwise, look up the default provider for the company and channel
  else if (companyId) {
    // Use different column based on channel type
    const providerTypeColumn = channel === 'email' ? 'default_email_provider' : 'default_phone_provider';
    
    console.log(`Looking up default ${channel} provider for company ${companyId}`);
    
    // Get the default provider ID from company
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select(providerTypeColumn)
      .eq('id', companyId)
      .single();
      
    if (companyError) {
      console.error(`Error fetching company:`, companyError);
      throw new Error(`Could not fetch company information: ${companyError.message}`);
    }
    
    const defaultProviderId = companyData[providerTypeColumn];
    
    if (!defaultProviderId) {
      throw new Error(`No default ${channel} provider configured for company ${companyId}`);
    }
    
    console.log(`Found default provider ID: ${defaultProviderId}`);
    
    providerInfo = await getProviderById(supabase, defaultProviderId, sourceIp);
  }
  else {
    throw new Error('Either providerId or companyId must be provided');
  }
  
  return providerInfo;
}

async function getProviderById(supabase: SupabaseClient, providerId: string, sourceIp: string): Promise<ProviderInfo> {
  console.log(`Looking up provider with ID: ${providerId}`);
  
  // Log the access
  try {
    await supabase.rpc('log_integration_key_access', {
      p_integration_id: providerId,
      p_accessed_by: 'send-communication function',
      p_access_reason: 'sending communication',
      p_source_ip: sourceIp
    });
  } catch (logError) {
    console.error('Failed to log integration key access:', logError);
    // Continue anyway - logging failure shouldn't prevent the main functionality
  }
  
  // Get the provider information
  const { data: providerData, error: providerError } = await supabase
    .from('company_integrations')
    .select('provider_name, api_key, api_secret, account_id, provider_type')
    .eq('id', providerId)
    .eq('is_active', true)
    .single();
    
  if (providerError) {
    console.error(`Error fetching provider:`, providerError);
    throw new Error(`Could not fetch provider information: ${providerError.message}`);
  }
  
  if (!providerData.api_key) {
    throw new Error(`Provider ${providerId} has no API key configured`);
  }

  // Get any additional provider-specific settings from the database
  const { data: additionalSettings, error: settingsError } = await supabase
    .from('provider_settings')
    .select('*')
    .eq('provider_id', providerId)
    .maybeSingle();

  let defaultPhone = null;
  let justcallNumber = null;
  
  if (!settingsError && additionalSettings) {
    defaultPhone = additionalSettings.default_phone;
    justcallNumber = additionalSettings.justcall_number;
  }

  // Log that we found the provider, but don't log the actual keys
  console.log(`Provider found with ID: ${providerId}`, {
    provider_name: providerData.provider_name,
    has_api_key: !!providerData.api_key,
    has_api_secret: !!providerData.api_secret,
    has_account_id: !!providerData.account_id
  });
  
  return {
    provider_name: providerData.provider_name,
    api_key: providerData.api_key,
    api_secret: providerData.api_secret,
    account_id: providerData.account_id,
    default_phone: defaultPhone,
    justcall_number: justcallNumber
  };
}
