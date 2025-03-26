
import { WebhookPayload } from './types.ts';

export async function parseWebhookPayload(req: Request): Promise<WebhookPayload> {
  // Log all headers
  console.log('--- START REQUEST HEADERS ---');
  for (const [key, value] of req.headers.entries()) {
    console.log(`${key}: ${value}`);
  }
  console.log('--- END REQUEST HEADERS ---');
  
  // Get content type to determine how to parse the body
  const contentType = req.headers.get('content-type') || '';
  console.log('Content-Type:', contentType);

  // Get the raw request body
  const requestText = await req.text();
  console.log('Raw request body:', requestText);
  
  // Parse payload based on content type
  let payload: WebhookPayload;
  
  if (contentType.includes('application/json')) {
    // Parse as JSON
    payload = JSON.parse(requestText);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    // Parse as form data
    payload = parseFormData(requestText);
  } else {
    // Try JSON parse as fallback
    try {
      payload = JSON.parse(requestText);
    } catch {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  }
  
  // Log details about the Bid_ID
  console.log(`Bid_ID value: ${payload.Bid_ID}`);
  console.log(`Bid_ID type: ${typeof payload.Bid_ID}`);
  
  // Check if Bid_ID is a number that needs string conversion
  if (typeof payload.Bid_ID === 'number') {
    console.log(`Converting Bid_ID from number to string: ${payload.Bid_ID} => "${String(payload.Bid_ID)}"`);
    // Don't convert here, just log for diagnostic purposes
  }
  
  // Log the entire parsed payload
  console.log('Parsed webhook payload:', payload);
  
  return payload;
}

function parseFormData(requestText: string): WebhookPayload {
  const formData = new URLSearchParams(requestText);
  
  // Log all form data entries for debugging
  console.log('--- Form data entries ---');
  for (const [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`);
  }
  console.log('--- End form data entries ---');
  
  // Check if the entire payload is in a single form field
  if (formData.has('payload')) {
    return JSON.parse(formData.get('payload') || '{}');
  } else if (formData.has('contacts')) {
    // Try to parse contacts as JSON if it's in a single parameter
    try {
      const contacts = JSON.parse(formData.get('contacts') || '[]');
      const bidIdRaw = formData.get('Bid_ID') || '';
      console.log(`Raw Bid_ID from form: "${bidIdRaw}", type: ${typeof bidIdRaw}`);
      
      // Check if it's a numeric string
      const bidId = bidIdRaw;
      console.log(`Final Bid_ID value: "${bidId}", type: ${typeof bidId}`);
      
      return {
        contacts: Array.isArray(contacts) ? contacts : [],
        Bid_ID: bidId
      };
    } catch {
      // If contacts can't be parsed as JSON, try to reconstruct from form data
      console.log('Reconstructing payload from form data');
      const payload: WebhookPayload = {
        contacts: [],
        Bid_ID: formData.get('Bid_ID') || ''
      };
      
      console.log(`Reconstructed Bid_ID: "${payload.Bid_ID}", type: ${typeof payload.Bid_ID}`);
      
      // Zoho might send data with indices like contacts[0][name], contacts[0][email], etc.
      // We need to reconstruct the contacts array
      const contactIndices = new Set<number>();
      for (const [key, value] of formData.entries()) {
        const match = key.match(/contacts\[(\d+)\]\[(\w+)\]/);
        if (match) {
          const index = parseInt(match[1], 10);
          contactIndices.add(index);
        }
      }
      
      if (contactIndices.size > 0) {
        for (const index of contactIndices) {
          const contact = {
            name: formData.get(`contacts[${index}][name]`) || '',
            number: formData.get(`contacts[${index}][number]`) || '',
            email: formData.get(`contacts[${index}][email]`) || '',
            role: formData.get(`contacts[${index}][role]`) || ''
          };
          payload.contacts.push(contact);
        }
      }
      
      return payload;
    }
  } else {
    throw new Error('Unable to find contacts or payload in form data');
  }
}
