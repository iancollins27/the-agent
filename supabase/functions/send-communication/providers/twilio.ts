
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
  
  return {
    provider: 'twilio',
    status: 'sent',
    provider_message_id: `twilio-${Date.now()}`
  };
}
