
import { ProviderInfo } from "../types.ts";

export async function sendViaTwilio(
  providerInfo: ProviderInfo, 
  channel: string, 
  message: string, 
  recipient: any,
  sender?: any
): Promise<any> {
  try {
    console.log(`Sending via Twilio: ${channel} to ${recipient.phone}`);
    
    // Check if we have required credentials
    if (!providerInfo.api_key || !providerInfo.api_secret) {
      throw new Error('Missing Twilio credentials (api_key or api_secret)');
    }

    // Format phone numbers (ensure they have the + prefix for E.164 format)
    const toPhone = recipient.phone.startsWith('+') ? recipient.phone : `+${recipient.phone}`;
    
    // Determine the 'from' number
    let fromPhone;
    if (sender && sender.phone) {
      fromPhone = sender.phone.startsWith('+') ? sender.phone : `+${sender.phone}`;
    } else if (providerInfo.justcall_number) {
      // Use justcall_number as a fallback if no sender but we have one stored
      fromPhone = providerInfo.justcall_number;
    } else {
      throw new Error('No sender phone number available');
    }
    
    // Prepare authorization for Twilio API
    const auth = btoa(`${providerInfo.api_key}:${providerInfo.api_secret}`);

    // Prepare the request body
    const formData = new URLSearchParams();
    formData.append('To', toPhone);
    formData.append('From', fromPhone);
    formData.append('Body', message);
    
    // Account SID is typically the first part of the API key
    // The AccountSid typically looks like "ACxxxxxxx..."
    const accountSid = providerInfo.account_id || providerInfo.api_key;
    
    // If accountSid doesn't start with "AC", try to use it anyway but log a warning
    if (!accountSid.startsWith('AC')) {
      console.warn('Twilio Account SID does not start with "AC". This might cause issues.');
    }
    
    // Make the API call to Twilio
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    console.log(`Making Twilio API request to: ${twilioEndpoint}`);
    console.log(`From: ${fromPhone}, To: ${toPhone}`);
    console.log(`Message length: ${message.length} characters`);
    
    const response = await fetch(twilioEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData
    });
    
    // Parse the response
    const responseData = await response.json();
    
    // Check if the request was successful
    if (!response.ok) {
      console.error('Twilio API error:', responseData);
      throw new Error(`Twilio API error: ${responseData.message || responseData.error_message || 'Unknown error'}`);
    }
    
    console.log('Successfully sent message via Twilio:', {
      sid: responseData.sid,
      status: responseData.status,
      direction: responseData.direction
    });
    
    // Return the Twilio response
    return {
      provider: 'twilio',
      status: responseData.status,
      provider_message_id: responseData.sid,
      provider_response: responseData
    };
  } catch (error) {
    console.error(`Error sending via Twilio: ${error.message}`);
    console.error(error.stack);
    throw error;
  }
}
