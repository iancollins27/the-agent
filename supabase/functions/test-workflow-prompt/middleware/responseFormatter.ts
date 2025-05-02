
import { corsHeaders } from '../utils/cors.ts';

/**
 * Middleware to format the response
 */
export function formatResponse(result: any, status: number = 200): Response {
  return new Response(
    JSON.stringify(result),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status
    }
  );
}

/**
 * Middleware to handle errors
 */
export function handleError(error: any): Response {
  console.error('Error in request handler:', error);
  
  return new Response(
    JSON.stringify({
      error: error.message || 'An unexpected error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    }
  );
}
