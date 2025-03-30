
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ProviderInfo } from "../types.ts";
import { sendViaJustCall } from "../providers/justcall.ts";
import { sendViaTwilio } from "../providers/twilio.ts";
import { sendViaSendgrid } from "../providers/sendgrid.ts";

export async function sendCommunication(
  supabase: SupabaseClient,
  providerInfo: ProviderInfo,
  channel: string,
  messageContent: string,
  recipient: any,
  sender: any = null,
  communicationId: string,
) {
  const normalizedProviderName = providerInfo.provider_name.toLowerCase();
  console.log(`Using normalized provider name: "${normalizedProviderName}" (original: "${providerInfo.provider_name}")`);

  // Prepare final recipient and sender information
  console.log("Final recipient information:", recipient);
  console.log("Final sender information:", sender || {});

  if (channel === 'sms') {
    console.log(`Sending sms via ${providerInfo.provider_name} to ${recipient.phone}`);
    
    if (normalizedProviderName === 'justcall') {
      return await sendViaJustCall(
        providerInfo, 
        recipient.phone, 
        messageContent, 
        sender,
        communicationId
      );
    } else if (normalizedProviderName === 'twilio') {
      return await sendViaTwilio(
        providerInfo, 
        recipient.phone, 
        messageContent, 
        sender?.phone || providerInfo.default_phone,
        communicationId
      );
    } else {
      throw new Error(`Unsupported provider for SMS: ${providerInfo.provider_name}`);
    }
  }
  
  else if (channel === 'email') {
    console.log(`Sending email via ${providerInfo.provider_name} to ${recipient.email}`);
    
    // Extract relevant email information from recipient and sender
    const recipientEmail = recipient.email;
    const recipientName = recipient.name;
    const senderEmail = sender?.email;
    const senderName = sender?.name;
    
    console.log(`Email details - To: ${recipientName} <${recipientEmail}>, From: ${senderName || 'No name'} <${senderEmail || 'No email'}>`);
    
    if (normalizedProviderName === 'sendgrid') {
      return await sendViaSendgrid(
        providerInfo,
        recipientEmail,
        recipientName,
        messageContent,
        senderEmail,
        senderName,
        communicationId
      );
    } else {
      throw new Error(`Unsupported provider for email: ${providerInfo.provider_name}`);
    }
  }
  
  else if (channel === 'call') {
    console.log(`Call functionality not implemented yet for ${providerInfo.provider_name}`);
    throw new Error(`Call functionality not implemented for provider: ${providerInfo.provider_name}`);
  }
  
  else {
    throw new Error(`Unknown communication channel: ${channel}`);
  }
}
