
import { ProviderInfo } from "../types.ts";

export async function sendViaJustCall(
  providerInfo: ProviderInfo, 
  channel: string, 
  message: string, 
  recipient: any
): Promise<any> {
  // Mock implementation - would be replaced with actual API call
  console.log(`MOCK: Sending via JustCall: ${channel} to ${recipient.phone}`);
  console.log(`JustCall API Key: ${providerInfo.api_key.substring(0, 3)}...`);
  
  return {
    provider: 'justcall',
    status: 'sent',
    provider_message_id: `justcall-${Date.now()}`
  };
}
