
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ProviderInfo } from "../types.ts";

export async function getProviderInfo(
  supabase: SupabaseClient,
  providerId?: string,
  companyId?: string,
  channel?: string,
  actionId?: string,
  sourceIp: string = 'unknown'
): Promise<ProviderInfo> {
  let providerInfo: ProviderInfo | null = null;
  
  // Log input parameters for debugging
  console.log("getProviderInfo called with:", {
    providerId,
    companyId, 
    channel,
    actionId,
    sourceIp
  });
  
  // If specific provider ID was provided, use that
  if (providerId) {
    providerInfo = await getProviderById(supabase, providerId, actionId, channel, sourceIp);
  } 
  // Otherwise use the default provider for this channel type if company ID is available
  else if (companyId && channel) {
    providerInfo = await getDefaultProvider(supabase, companyId, channel, actionId, sourceIp);
  }

  // If still no provider found, use mock provider
  if (!providerInfo) {
    console.log('No provider found, using mock provider for testing');
    providerInfo = { 
      provider_name: 'mock',
      api_key: 'mock-key',
      api_secret: 'mock-secret'
    };
  }
  
  return providerInfo;
}

async function getProviderById(
  supabase: SupabaseClient,
  providerId: string,
  actionId?: string,
  channel?: string,
  sourceIp: string = 'unknown'
): Promise<ProviderInfo | null> {
  console.log(`Looking up provider with ID: ${providerId}`);
  
  // Log access to the integration keys
  await logIntegrationKeyAccess(
    supabase,
    providerId,
    actionId ? `send-communication function (action: ${actionId})` : 'send-communication function',
    `Sending ${channel || 'unknown'} communication`,
    sourceIp
  );
  
  // Get provider credentials using the secure function
  const { data: providerData, error: providerError } = await supabase.rpc(
    'get_company_integration_keys',
    { integration_id: providerId }
  );
  
  if (providerError) {
    console.error(`Error fetching provider details: ${providerError.message}`);
    return null;
  } 
  
  if (providerData && providerData.length > 0) {
    // Query to get the provider_name, as it's not included in the secure RPC
    const { data: integrationData, error: integrationError } = await supabase
      .from('company_integrations')
      .select('provider_name')
      .eq('id', providerId)
      .single();
      
    // Merge the provider_name from company_integrations with the secure credentials
    const providerName = integrationError ? 'unnamed' : integrationData?.provider_name || 'unnamed';
    
    console.log(`Provider found with ID: ${providerId}`, {
      provider_name: providerName,
      has_api_key: !!providerData[0].api_key,
      has_api_secret: !!providerData[0].api_secret,
      has_account_id: !!providerData[0].account_id
    });
    
    return {
      ...providerData[0],
      provider_name: providerName
    };
  }
  
  console.log(`No provider found with ID: ${providerId}`);
  return null;
}

async function getDefaultProvider(
  supabase: SupabaseClient,
  companyId: string,
  channel: string,
  actionId?: string,
  sourceIp: string = 'unknown'
): Promise<ProviderInfo | null> {
  let providerType: string;
  let defaultProviderColumn: string;
  
  // Map channel to provider type and column name
  switch(channel.toLowerCase()) {
    case 'email':
      providerType = 'email';
      defaultProviderColumn = 'default_email_provider';
      break;
    case 'crm':
      providerType = 'crm';
      defaultProviderColumn = 'default_crm_provider';
      break;
    default: // phone, sms, call, etc.
      providerType = 'phone';
      defaultProviderColumn = 'default_phone_provider';
      break;
  }
  
  console.log(`Looking up default ${providerType} provider for company ${companyId}`);
  
  // Get the default provider ID for this channel
  const { data: companyData, error: companyError } = await supabase
    .from('companies')
    .select(defaultProviderColumn)
    .eq('id', companyId)
    .single();
    
  if (companyError) {
    console.error(`Error fetching company: ${companyError.message}`);
    return null;
  } 
  
  if (companyData && companyData[defaultProviderColumn]) {
    const defaultProviderId = companyData[defaultProviderColumn];
    console.log(`Found default provider ID: ${defaultProviderId}`);
    
    return await getProviderById(supabase, defaultProviderId, actionId, channel, sourceIp);
  }
  
  return null;
}

async function logIntegrationKeyAccess(
  supabase: SupabaseClient,
  integrationId: string,
  accessedBy: string,
  accessReason: string,
  sourceIp: string
): Promise<void> {
  await supabase.rpc(
    'log_integration_key_access',
    { 
      p_integration_id: integrationId,
      p_accessed_by: accessedBy,
      p_access_reason: accessReason,
      p_source_ip: sourceIp
    }
  );
}
