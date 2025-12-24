import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ToolRequest, ToolResponse, successResponse, errorResponse } from '../_shared/tool-types/request-response.ts';
import { validateSecurityContext } from '../_shared/tool-types/security-context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest = await req.json();

    // Validate security context
    const validation = validateSecurityContext(securityContext);
    if (!validation.valid) {
      return new Response(
        JSON.stringify(errorResponse(validation.error || 'Invalid security context')),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = args;

    if (!action) {
      return new Response(
        JSON.stringify(errorResponse('Action is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[tool-session-manager] Action: ${action}, company: ${securityContext.company_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result: ToolResponse;

    switch (action) {
      case 'get':
        result = await getSession(supabase, args, securityContext);
        break;
      case 'update':
        result = await updateSession(supabase, args, securityContext);
        break;
      case 'create':
        result = await createSession(supabase, args, securityContext);
        break;
      case 'find':
        result = await findSession(supabase, args, securityContext);
        break;
      default:
        result = errorResponse(`Unknown action: ${action}`, 'Supported actions are: get, update, create, find');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tool-session-manager] Error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message || 'Unknown error')),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getSession(supabase: any, args: any, securityContext: any): Promise<ToolResponse> {
  const { session_id } = args;

  if (!session_id) {
    return errorResponse('Missing session_id', 'session_id is required for get operation');
  }

  // Verify company access
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('company_id', securityContext.company_id)
    .single();

  if (error) {
    return errorResponse(error.message, 'Session not found or access denied');
  }

  return successResponse({ session }, 'Session retrieved successfully');
}

async function updateSession(supabase: any, args: any, securityContext: any): Promise<ToolResponse> {
  const { session_id, project_id, contact_id, memory_mode } = args;

  if (!session_id) {
    return errorResponse('Missing session_id', 'session_id is required for update operation');
  }

  // Verify session belongs to company
  const { data: existingSession, error: checkError } = await supabase
    .from('chat_sessions')
    .select('id, company_id')
    .eq('id', session_id)
    .eq('company_id', securityContext.company_id)
    .single();

  if (checkError || !existingSession) {
    return errorResponse('Access denied', 'Session not found or you do not have permission to update it');
  }

  // Build update object
  const updates: Record<string, any> = { last_activity: new Date().toISOString() };
  if (project_id !== undefined) updates.project_id = project_id;
  if (contact_id !== undefined) updates.contact_id = contact_id;
  if (memory_mode !== undefined) updates.memory_mode = memory_mode;

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .update(updates)
    .eq('id', session_id)
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 'Failed to update session');
  }

  return successResponse({ session }, 'Session updated successfully');
}

async function createSession(supabase: any, args: any, securityContext: any): Promise<ToolResponse> {
  const { channel_type, channel_identifier, contact_id, project_id, memory_mode, communication_id } = args;

  if (!channel_type || !channel_identifier) {
    return errorResponse('Missing required fields', 'channel_type and channel_identifier are required');
  }

  // Calculate expiry based on channel type
  const expiryMs = channel_type === 'email' ? 7 * 24 * 60 * 60 * 1000 
                 : channel_type === 'web' ? 1 * 60 * 60 * 1000 
                 : 24 * 60 * 60 * 1000;

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      channel_type,
      channel_identifier,
      contact_id: contact_id || null,
      company_id: securityContext.company_id,
      project_id: project_id || null,
      memory_mode: memory_mode || 'standard',
      expires_at: new Date(Date.now() + expiryMs).toISOString()
    })
    .select()
    .single();

  if (error) {
    return errorResponse(error.message, 'Failed to create session');
  }

  // Link communication if provided
  if (communication_id) {
    await supabase
      .from('communications')
      .update({ session_id: session.id })
      .eq('id', communication_id);
  }

  return successResponse({ session }, 'Session created successfully');
}

async function findSession(supabase: any, args: any, securityContext: any): Promise<ToolResponse> {
  const { channel_type, channel_identifier } = args;

  if (!channel_type || !channel_identifier) {
    return errorResponse('Missing required fields', 'channel_type and channel_identifier are required');
  }

  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('channel_type', channel_type)
    .eq('channel_identifier', channel_identifier)
    .eq('company_id', securityContext.company_id)
    .eq('active', true)
    .gt('expires_at', new Date().toISOString())
    .order('last_activity', { ascending: false });

  if (error) {
    return errorResponse(error.message, 'Failed to find sessions');
  }

  return successResponse(
    { sessions, count: sessions?.length || 0 },
    sessions?.length > 0 ? 'Active sessions found' : 'No active sessions found'
  );
}
