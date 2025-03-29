
import { ProviderInfo } from "../types.ts";

export async function sendViaTwilio(
  providerInfo: ProviderInfo, 
  channel: string, 
  message: string, 
  recipient: any
): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending via Twilio: ${channel} to ${recipient.phone}`);
  console.log(`Twilio API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  // Add more debugging to help diagnose any issues
  console.log(`Recipient details:`, JSON.stringify(recipient, null, 2));
  console.log(`Message:`, message.substring(0, 50) + (message.length > 50 ? '...' : ''));
  console.log(`Provider Info:`, {
    name: providerInfo.provider_name,
    api_key_length: providerInfo.api_key?.length || 0,
    has_secret: !!providerInfo.api_secret,
    has_account: !!providerInfo.account_id
  });
  
  return {
    provider: 'twilio',
    status: 'sent',
    provider_message_id: `twilio-${Date.now()}`
  };
}
