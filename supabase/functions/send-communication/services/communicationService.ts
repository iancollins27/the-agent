
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
  console.log(`Sending ${channel} via ${provider.provider_name} to ${recipient.phone || recipient.email}`);

  // Route to the appropriate provider service
  switch (provider.provider_name.toLowerCase()) {
    case 'justcall':
      return await sendViaJustCall(provider, channel, message, recipient);
    case 'twilio':
      return await sendViaTwilio(provider, channel, message, recipient);
    case 'sendgrid':
      return await sendViaSendGrid(provider, message, recipient);
    default:
      // For now, simulate success for testing
      console.log(`Using ${provider.provider_name} provider - mock implementation for testing`);
      return {
        mock: true,
        status: 'sent',
        provider_message_id: `mock-${Date.now()}`
      };
  }
}
