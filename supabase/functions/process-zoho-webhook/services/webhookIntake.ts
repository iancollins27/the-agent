
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
    // Log the request content type and other relevant headers
    console.log("Content-Type:", req.headers.get('content-type'));
    console.log("Content-Length:", req.headers.get('content-length'));
    
    // Extract headers for logging and authentication
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    console.log("Request headers:", JSON.stringify(headers));
    
    // Generate a request ID for tracking this specific request through logs
    const requestId = crypto.randomUUID();
    console.log(`[${requestId}] Processing webhook request`);
    
    // Safely parse the request body
    let payload;
    try {
      // Clone the request to avoid consuming it
      const clonedReq = req.clone();
      
      // Check if content-length header suggests empty body
      const contentLength = clonedReq.headers.get('content-length');
      if (contentLength === '0' || contentLength === null) {
        console.log(`[${requestId}] Warning: Request has empty or missing Content-Length header`);
      }
      
      // Get raw text first
      const rawText = await clonedReq.text();
      
      // Check for empty body early
      if (!rawText || rawText.trim() === '') {
        console.log(`[${requestId}] Empty request body detected`);
        return {
          payload: {},
          source: 'unknown',
          authenticated: false,
          headers
        };
      }
      
      console.log(`[${requestId}] Raw webhook payload text (${rawText.length} bytes):`, 
                 rawText.substring(0, 500) + (rawText.length > 500 ? '...' : ''));
      
      // Try to parse the text into JSON, with special handling for control characters
      try {
        // Replace any invalid control characters before parsing
        const cleanText = rawText.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
        payload = JSON.parse(cleanText);
        console.log(`[${requestId}] Successfully parsed JSON payload`);
      } catch (jsonError) {
        console.error(`[${requestId}] JSON parse error:`, jsonError.message);
        
        // If JSON parsing fails, check if it's form data
        if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
          const formData = new URLSearchParams(rawText);
          // Convert form data to object
          payload = Object.fromEntries(formData.entries());
          console.log(`[${requestId}] Parsed form data payload:`, payload);
        } 
        // Check if it might be stringified JSON inside a form field
        else if (rawText.includes('=') && rawText.includes('{')) {
          try {
            const formData = new URLSearchParams(rawText);
            // Look for JSON in the form values
            for (const [key, value] of formData.entries()) {
              if (value.startsWith('{') && value.endsWith('}')) {
                try {
                  const jsonValue = JSON.parse(value);
                  console.log(`[${requestId}] Found JSON in form field ${key}`);
                  payload = jsonValue;
                  break;
                } catch (e) {
                  console.log(`[${requestId}] Form field ${key} contains invalid JSON`);
                }
              }
            }
            
            // If we still don't have a payload, use the form data as is
            if (!payload) {
              payload = Object.fromEntries(formData.entries());
            }
          } catch (formError) {
            console.error(`[${requestId}] Form parsing error:`, formError.message);
            throw jsonError; // Rethrow the original error if form parsing also fails
          }
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
    const source = determineSource(payload, headers);
    
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
 * Determine the source of the webhook based on payload and headers
 */
function determineSource(payload: any, headers: Record<string, string>): string {
  // Check headers for common webhook source identifiers
  if (headers['x-zoho-webhook'] || headers['zoho-webhook-token']) {
    return 'zoho';
  }
  
  // Check payload for source-specific patterns
  if (payload && typeof payload === 'object') {
    if (payload.zoho_id || payload.zoho_module) {
      return 'zoho';
    }
  }
  
  // Default source
  return 'zoho';
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
