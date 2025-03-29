
import { ProviderInfo } from "../types.ts";

export async function sendViaJustCall(
  providerInfo: ProviderInfo, 
  channel: string, 
  message: string, 
  recipient: any
): Promise<any> {
  console.log(`Sending via JustCall: ${channel} to ${recipient.phone}`);
  
  // Log partial API key for debugging (first 3 chars only for security)
  console.log(`JustCall API Key: ${providerInfo.api_key.substring(0, 3)}...`);

  // Only proceed with SMS channel
  if (channel.toLowerCase() !== 'sms') {
    console.log(`JustCall only supports SMS channel, received: ${channel}`);
    throw new Error(`Unsupported channel for JustCall: ${channel}`);
  }

  // Make sure we have the recipient phone number
  if (!recipient.phone) {
    console.log('No recipient phone number provided');
    throw new Error('Recipient phone number is required for JustCall SMS');
  }

  // Get the JustCall number - first try from provider config, then from sender
  let justcallNumber = providerInfo.justcall_number;
  
  // If not in provider config, try to get from sender
  if (!justcallNumber && recipient.sender && recipient.sender.phone) {
    justcallNumber = recipient.sender.phone;
    console.log(`Using sender's phone number as JustCall number: ${justcallNumber}`);
  }
  
  // If still not available, check if there's a sender_phone in the recipient object
  if (!justcallNumber && recipient.sender_phone) {
    justcallNumber = recipient.sender_phone;
    console.log(`Using sender_phone as JustCall number: ${justcallNumber}`);
  }
  
  // Final check if JustCall number is available
  if (!justcallNumber) {
    console.log('No JustCall number provided in provider config or sender information');
    throw new Error('JustCall number is required either in provider configuration or as sender phone number');
  }

  // Create authorization header using API key and secret
  const authHeader = `${providerInfo.api_key}:${providerInfo.api_secret}`;
  
  try {
    // Prepare request payload
    const payload = {
      justcall_number: justcallNumber, // The JustCall number to send from
      body: message, // The SMS message content
      contact_number: recipient.phone, // The recipient's phone number
      restrict_once: "Yes" // Prevent duplicate messages
    };

    console.log(`JustCall API request payload: ${JSON.stringify({
      ...payload,
      body: payload.body.substring(0, 30) + (payload.body.length > 30 ? '...' : '')
    })}`);

    // Make the API call to JustCall
    const response = await fetch('https://api.justcall.io/v2.1/texts/new', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Parse the response
    const responseData = await response.json();
    
    // Log response status and partial data
    console.log(`JustCall API response status: ${response.status}`);
    console.log(`JustCall API response: ${JSON.stringify(responseData).substring(0, 200)}...`);

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`JustCall API error: ${response.status} - ${JSON.stringify(responseData)}`);
    }

    // Return a structured response
    return {
      provider: 'justcall',
      status: 'sent',
      provider_message_id: responseData.message_id || `justcall-${Date.now()}`,
      provider_response: responseData
    };
  } catch (error) {
    console.error(`Error sending SMS via JustCall: ${error.message}`);
    throw error;
  }
}
