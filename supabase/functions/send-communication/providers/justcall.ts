
import { ProviderInfo, Recipient, Sender } from "../types.ts";

export async function sendViaJustCall(
  providerInfo: ProviderInfo,
  recipient: string,
  message: string,
  sender?: Sender,
  communicationId?: string
) {
  console.log(`Sending via JustCall: sms to ${recipient}`);
  console.log(`JustCall API Key: ${providerInfo.api_key.substring(0, 3)}...`);

  // Determine the JustCall sender number from various possible sources
  const justCallNumber = providerInfo.justcall_number || 
                       sender?.phone || 
                       providerInfo.action_sender_phone ||
                       providerInfo.default_phone;

  if (!justCallNumber) {
    console.log("No JustCall number found in available locations. This is required for sending.");
    throw new Error("JustCall number is required either in provider configuration or as sender phone number. Please configure this in the provider settings.");
  }

  console.log(`Using JustCall number: ${justCallNumber} for outbound communication`);

  const url = "https://justcall.io/api/v1/texts";
  
  // Prepare the request payload
  const body = {
    from: justCallNumber,
    to: recipient,
    body: message,
    autoresponse: false,
  };
  
  console.log("JustCall API request payload:", JSON.stringify(body, null, 2));

  // Send the API request
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `${providerInfo.api_key}:${providerInfo.api_secret || ''}`,
    },
    body: JSON.stringify(body),
  });

  // Parse and return the response
  const data = await response.json();

  console.log(`JustCall API response (status ${response.status}):`, JSON.stringify(data, null, 2));
  
  if (!response.ok) {
    throw new Error(`JustCall API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}
