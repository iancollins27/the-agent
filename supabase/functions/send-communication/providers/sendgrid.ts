
import { ProviderInfo } from "../types.ts";

export async function sendViaSendGrid(
  providerInfo: ProviderInfo, 
  message: string, 
  recipient: any
): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending email via SendGrid to ${recipient.email}`);
  console.log(`SendGrid API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  return {
    provider: 'sendgrid',
    status: 'sent',
    provider_message_id: `sendgrid-${Date.now()}`
  };
}
