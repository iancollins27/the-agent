
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ProviderInfo } from "../types.ts";
import { log_integration_key_access } from "./databaseService.ts";

export async function getProviderInfo(
  supabase: SupabaseClient,
  providerId?: string,
  companyId?: string,
  channel?: string,
  actionId?: string,
  sourceIp?: string
): Promise<ProviderInfo> {
  console.log("getProviderInfo called with:", {
    providerId,
    companyId,
    channel,
    actionId,
    sourceIp
  });

  // If a specific provider is specified, use that
  if (providerId) {
    console.log(`Looking up specific provider with ID: ${providerId}`);
    return await getProviderById(supabase, providerId, sourceIp);
  }

  // Check if this is related to an action
  let actionSenderPhone = null;
  if (actionId) {
    // Try to get the sender_phone from the action record
    try {
      const { data: actionData, error: actionError } = await supabase
        .from('action_records')
        .select('sender_phone')
        .eq('id', actionId)
        .single();
      
      if (!actionError && actionData && actionData.sender_phone) {
        actionSenderPhone = actionData.sender_phone;
        console.log(`Found sender_phone ${actionSenderPhone} in action record ${actionId}`);
      } else if (actionError) {
        console.error(`Error fetching action record ${actionId}:`, actionError);
      } else {
        console.log(`No sender_phone found in action record ${actionId}`);
      }
    } catch (error) {
      console.error(`Error checking action record for sender_phone:`, error);
    }
  }

  // If we have a company ID, try to get the default provider for this channel
  if (companyId) {
    const normalizedChannel = channel ? channel.toLowerCase() : 'sms';
    let defaultProviderColumn = '';
    
    switch (normalizedChannel) {
      case 'email':
        defaultProviderColumn = 'default_email_provider';
        break;
      case 'sms':
      case 'call':
      default:
        defaultProviderColumn = 'default_phone_provider';
        break;
    }
    
    console.log(`Looking up default ${normalizedChannel} provider for company ${companyId}`);
    
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(defaultProviderColumn)
      .eq('id', companyId)
      .single();
    
    if (companyError) {
      console.error(`Error fetching company ${companyId}:`, companyError);
    } else if (company && company[defaultProviderColumn]) {
      const defaultProviderId = company[defaultProviderColumn];
      console.log(`Found default provider ID: ${defaultProviderId}`);
      
      // Get the provider details
      const providerInfo = await getProviderById(supabase, defaultProviderId, sourceIp);
      
      // Add the action_sender_phone to the provider info if we have it
      if (actionSenderPhone) {
        providerInfo.action_sender_phone = actionSenderPhone;
        console.log(`Added action_sender_phone (${actionSenderPhone}) to provider info`);
      }
      
      return providerInfo;
    }
  }
  
  throw new Error(`No valid communication provider found for company ${companyId}`);
}

async function getProviderById(
  supabase: SupabaseClient,
  providerId: string,
  sourceIp: string
): Promise<ProviderInfo> {
  console.log(`Looking up provider with ID: ${providerId}`);
  
  // Get integration details from database
  const { data: integration, error: integrationError } = await supabase
    .from('company_integrations')
    .select('id, provider_name, api_key, api_secret, account_id')
    .eq('id', providerId)
    .eq('is_active', true)
    .single();
  
  if (integrationError) {
    console.error(`Error fetching integration ${providerId}:`, integrationError);
    throw new Error(`Provider not found or not active: ${integrationError.message}`);
  }
  
  // Log access to sensitive keys
  try {
    await log_integration_key_access(supabase, integration.id, 'send-communication function', sourceIp);
  } catch (logError) {
    console.error("Error logging key access:", logError);
    // Continue even if logging fails
  }
  
  // Process provider name for normalization
  const providerName = integration.provider_name;
  const normalizedProviderName = providerName.toLowerCase().trim();
  console.log(`Using normalized provider name: "${normalizedProviderName}" (original: "${providerName}")`);
  
  // Return provider info
  const providerInfo: ProviderInfo = {
    provider_name: providerName,
    api_key: integration.api_key,
    api_secret: integration.api_secret,
    account_id: integration.account_id
  };
  
  console.log(`Provider found with ID: ${providerId}`, {
    provider_name: providerInfo.provider_name,
    has_api_key: !!providerInfo.api_key,
    has_api_secret: !!providerInfo.api_secret,
    has_account_id: !!providerInfo.account_id
  });
  
  return providerInfo;
}
