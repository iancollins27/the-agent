
import { sendViaJustCall } from "../providers/justcall.ts";
import { sendViaTwilio } from "../providers/twilio.ts";
import { ProviderInfo } from "../types.ts";

export async function sendCommunication(
  supabase: any,
  providerInfo: ProviderInfo, 
  channel: string, 
  message: string, 
  recipient: any,
  commId: string,
  sender?: any
): Promise<any> {
  try {
    console.log(`Using normalized provider name: "${providerInfo.provider_name.toLowerCase()}" (original: "${providerInfo.provider_name}")`);
    console.log(`Sending ${channel} via ${providerInfo.provider_name} to ${recipient.phone || recipient.email}`);

    // Determine which provider to use
    const providerName = providerInfo.provider_name.toLowerCase();
    
    let result;
    
    switch (providerName) {
      case 'justcall':
        result = await sendViaJustCall(providerInfo, channel, message, recipient, sender);
        break;
        
      case 'twilio':
        result = await sendViaTwilio(providerInfo, channel, message, recipient, sender);
        break;
        
      case 'sendgrid':
      case 'email':
        throw new Error('Email communications are not currently supported');
        
      default:
        throw new Error(`Unsupported communication provider: ${providerInfo.provider_name}`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error sending communication: ${error.message}`);
    throw error;
  }
}
