
import { corsHeaders } from '../utils/cors.ts';

/**
 * Middleware to parse the request body and validate required fields
 */
export async function parseRequestBody(req: Request): Promise<{ body: any, error: null } | { body: null, error: Response }> {
  try {
    const body = await req.json();
    
    // Log request details
    console.log('Processing request through request parser middleware');
    
    // Basic validation
    if (!body) {
      return {
        body: null,
        error: new Response(
          JSON.stringify({ error: 'Request body is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      };
    }

    // Extract and validate essential parameters
    const {
      promptType,
      promptText,
      projectId,
    } = body;
    
    if (!promptType) {
      return {
        body: null,
        error: new Response(
          JSON.stringify({ error: 'promptType is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      };
    }

    // For non-MCP requests, promptText is required
    if (!promptText && promptType !== 'mcp_orchestrator' && body.useMCP !== true) {
      return {
        body: null,
        error: new Response(
          JSON.stringify({ error: 'promptText is required for non-MCP requests' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      };
    }
    
    // Log validation passed
    console.log(`Request validation passed for prompt type: ${promptType}`);
    
    return { body, error: null };
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return { 
      body: null, 
      error: new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      ) 
    };
  }
}
