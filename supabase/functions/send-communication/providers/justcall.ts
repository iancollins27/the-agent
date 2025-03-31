
import { ProviderInfo } from "../types.ts";

export async function sendViaJustCall(
  providerInfo: ProviderInfo,
  recipient: string,
  message: string,
  sender?: {
    id?: string;
    phone?: string;
    email?: string;
    name?: string;
  },
  communicationId?: string
) {
  console.log(`Sending via JustCall: sms to ${recipient}`);
  console.log(`JustCall API Key: ${providerInfo.api_key.substring(0, 3)}...`);

  // Look for JustCall number in different places
  console.log("Looking for JustCall number in the following places:");
  
  // Check provider config for number
  console.log("- provider justcall_number: ", providerInfo.justcall_number);
  
  // Check sender object for phone
  console.log("- sender.phone: ", sender?.phone);

  // Check legacy paths (compatibility)
  console.log("- recipient.sender_phone (legacy): ", recipient['sender_phone']);
  console.log("- recipient.sender?.phone_number (legacy): ", recipient['sender'] ? recipient['sender'].phone_number : "sender not defined");
  console.log("- recipient.sender?.phone (legacy): ", recipient['sender'] ? recipient['sender'].phone : "sender not defined");
  console.log("- provider default_phone: ", providerInfo.default_phone);

  // Try to get the JustCall number from any available source
  const justCallNumber = providerInfo.justcall_number || 
                       sender?.phone || 
                       recipient['sender_phone'] || 
                       (recipient['sender'] && recipient['sender'].phone_number) ||
                       (recipient['sender'] && recipient['sender'].phone) ||
                       providerInfo.default_phone;

  if (!justCallNumber) {
    console.log("No JustCall number found in any of these locations. This is required for sending.");
    
    // Detailed error message to help with debugging
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
