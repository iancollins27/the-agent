
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
    console.log(`Communication ID: ${commId}`);
    
    // Log sender information
    if (sender) {
      console.log(`Sender details: ${sender.phone ? `phone=${sender.phone}` : ''} ${sender.email ? `email=${sender.email}` : ''}`);
    } else {
      console.log(`No sender details provided, using provider defaults`);
    }

    // Determine which provider to use
    const providerName = providerInfo.provider_name.toLowerCase();
    
    let result;
    
    switch (providerName) {
      case 'justcall':
        console.log(`Using JustCall provider`);
        result = await sendViaJustCall(providerInfo, channel, message, recipient, sender);
        break;
        
      case 'twilio':
        console.log(`Using Twilio provider`);
        result = await sendViaTwilio(providerInfo, channel, message, recipient, sender);
        break;
        
      case 'sendgrid':
      case 'email':
        console.log(`Email provider requested but not supported`);
        throw new Error('Email communications are not currently supported');
        
      case 'mock':
        // Handle mock provider for testing
        console.log(`Using mock provider for testing`);
        result = {
          provider: 'mock',
          status: 'test',
          provider_message_id: `mock-${Date.now()}`,
          provider_response: { mock: true, message: 'This is a test message response' }
        };
        break;
        
      default:
        console.error(`Unknown provider: ${providerInfo.provider_name}`);
        throw new Error(`Unsupported communication provider: ${providerInfo.provider_name}`);
    }
    
    console.log(`Communication sent successfully via ${providerName}`, {
      status: result.status,
      provider_message_id: result.provider_message_id
    });
    
    return result;
  } catch (error) {
    console.error(`Error sending communication: ${error.message}`);
    // Add more error details
    console.error(`Error stack: ${error.stack || 'No stack trace available'}`);
    console.error(`Provider: ${providerInfo.provider_name}, Channel: ${channel}`);
    throw error;
  }
}
