
/**
 * Webhook Intake Service
 * Responsible for receiving and authenticating webhook requests
 */
import { corsHeaders } from "../utils/cors.ts";

/**
 * Extracts and verifies the webhook payload
 * @param req The HTTP request object
 * @returns Extracted payload and metadata
 */
export async function processWebhookRequest(req: Request): Promise<{
  payload: any;
  source: string;
  authenticated: boolean;
  headers: Record<string, string>;
}> {
  try {
    // Log the request content type
    console.log("Content-Type:", req.headers.get('content-type'));
    
    // Extract headers for logging and authentication
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    // Safely parse the request body
    let payload;
    try {
      // Clone the request to avoid consuming it
      const clonedReq = req.clone();
      // Get raw text first
      const rawText = await clonedReq.text();
      console.log('Raw webhook payload text:', rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''));
      
      // Try to parse the text into JSON, with special handling for control characters
      try {
        // Replace any invalid control characters before parsing
        const cleanText = rawText.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
        payload = JSON.parse(cleanText);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError.message);
        // If JSON parsing fails, check if it's form data
        if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
          const formData = new URLSearchParams(rawText);
          // Convert form data to object
          payload = Object.fromEntries(formData.entries());
          console.log('Parsed form data payload:', payload);
        } else {
          throw jsonError;
        }
      }
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      throw new Error(`Invalid request format: ${parseError.message}`);
    }
    
    // For now, we assume Zoho as the source
    // In a more complete implementation, we would determine the source based on headers or payload structure
    const source = 'zoho';
    
    // Simple authentication - in a real system, this would validate API keys, signatures, etc.
    const authenticated = true;
    
    console.log(`Processed ${source} webhook:`, JSON.stringify(payload).substring(0, 200) + '...');
    
    return {
      payload,
      source,
      authenticated,
      headers
    };
  } catch (error) {
    console.error('Error in webhook intake service:', error);
    throw error;
  }
}

/**
 * Creates an error response with appropriate CORS headers
 * @param message Error message
 * @param status HTTP status code
 * @returns Response object
 */
export function createErrorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status
    }
  );
}

/**
 * Creates a success response with appropriate CORS headers
 * @param data Response data
 * @returns Response object
 */
export function createSuccessResponse(data: any): Response {
  return new Response(
    JSON.stringify(data),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
