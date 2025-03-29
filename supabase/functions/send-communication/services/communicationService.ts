
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ProviderInfo } from "../types.ts";
import { sendViaJustCall } from "../providers/justcall.ts";
import { sendViaTwilio } from "../providers/twilio.ts";
import { sendViaSendGrid } from "../providers/sendgrid.ts";

export async function sendCommunication(
  supabase: SupabaseClient,
  provider: ProviderInfo,
  channel: string,
  message: string,
  recipient: any,
  communicationId: string
): Promise<any> {
  // Check if provider_name exists before using it
  const providerName = provider?.provider_name || 'unknown';
  console.log(`Sending ${channel} via ${providerName} to ${recipient.phone || recipient.email}`);

  // Route to the appropriate provider service
  switch (providerName.toLowerCase()) {
    case 'justcall':
      return await sendViaJustCall(provider, channel, message, recipient);
    case 'twilio':
      return await sendViaTwilio(provider, channel, message, recipient);
    case 'sendgrid':
      return await sendViaSendGrid(provider, message, recipient);
    default:
      // For now, simulate success for testing
      console.log(`Using ${providerName} provider - mock implementation for testing`);
      return {
        mock: true,
        status: 'sent',
        provider_message_id: `mock-${Date.now()}`
      };
  }
}
