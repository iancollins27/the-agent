
import { ProviderInfo } from "../types.ts";

export async function sendViaSendGrid(
  providerInfo: ProviderInfo,
  recipientEmail: string,
  recipientName: string,
  message: string,
  senderEmail?: string,
  senderName?: string,
  communicationId?: string
): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending email via SendGrid to ${recipientEmail}`);
  console.log(`SendGrid API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  if (senderEmail) {
    console.log(`From email address: ${senderEmail}`);
  }
  
  if (senderName) {
    console.log(`From name: ${senderName}`);
  }
  
  return {
    provider: 'sendgrid',
    status: 'sent',
    provider_message_id: `sendgrid-${Date.now()}`
  };
}
