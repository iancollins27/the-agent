
import { WebhookPayload } from './types.ts';

export async function parseWebhookPayload(req: Request): Promise<WebhookPayload> {
  // Get content type to determine how to parse the body
  const contentType = req.headers.get('content-type') || '';
  console.log('Content-Type:', contentType);

  // Get the raw request body
  const requestText = await req.text();
  console.log('Raw request body:', requestText);
  
  // Parse payload based on content type
  if (contentType.includes('application/json')) {
    // Parse as JSON
    return JSON.parse(requestText);
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    // Parse as form data
    return parseFormData(requestText);
  } else {
    // Try JSON parse as fallback
    try {
      return JSON.parse(requestText);
    } catch {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  }
}

function parseFormData(requestText: string): WebhookPayload {
  const formData = new URLSearchParams(requestText);
  
  // Check if the entire payload is in a single form field
  if (formData.has('payload')) {
    return JSON.parse(formData.get('payload') || '{}');
  } else if (formData.has('contacts')) {
    // Try to parse contacts as JSON if it's in a single parameter
    try {
      const contacts = JSON.parse(formData.get('contacts') || '[]');
      const bidId = formData.get('Bid_ID') || '';
      return {
        contacts: Array.isArray(contacts) ? contacts : [],
        Bid_ID: parseInt(bidId, 10)
      };
    } catch {
      // If contacts can't be parsed as JSON, try to reconstruct from form data
      console.log('Reconstructing payload from form data');
      const payload: WebhookPayload = {
        contacts: [],
        Bid_ID: parseInt(formData.get('Bid_ID') || '0', 10)
      };
      
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
