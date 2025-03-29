
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

  // Get the sender's phone number to use as JustCall number
  let justcallNumber = null;
  
  // First check if sender exists and has a phone_number field
  if (recipient.sender && recipient.sender.phone) {
    justcallNumber = recipient.sender.phone;
    console.log(`Using sender's phone number as JustCall number: ${justcallNumber}`);
  } 
  // Then check for sender_phone (legacy field)
  else if (recipient.sender_phone) {
    justcallNumber = recipient.sender_phone;
    console.log(`Using sender_phone as JustCall number: ${justcallNumber}`);
  }
  
  // If sender phone is not available, check if provider has justcall_number configured
  if (!justcallNumber && providerInfo.justcall_number) {
    justcallNumber = providerInfo.justcall_number;
    console.log(`Using provider configured JustCall number: ${justcallNumber}`);
  }
  
  // Final check if JustCall number is available
  if (!justcallNumber) {
    console.log('No sender phone number found');
    throw new Error('Sender phone number is required for JustCall SMS');
  }

  // Create authorization header using API key and secret
  const authHeader = `${providerInfo.api_key}:${providerInfo.api_secret}`;
  
  try {
    // Prepare request payload
    const payload = {
      justcall_number: justcallNumber, // The JustCall number to send from (sender's phone)
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
