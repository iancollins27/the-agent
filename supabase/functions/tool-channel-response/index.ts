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

    const { session_id, message, project_id } = args;

    if (!session_id) {
      return new Response(
        JSON.stringify(errorResponse('Missing session_id', 'session_id is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!message) {
      return new Response(
        JSON.stringify(errorResponse('Missing message', 'message content is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[tool-channel-response] Sending to session: ${session_id}, company: ${securityContext.company_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get session details and verify access
    const { data: sessionData, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('channel_type, company_id')
      .eq('id', session_id)
      .eq('company_id', securityContext.company_id)
      .single();

    if (sessionError || !sessionData) {
      return new Response(
        JSON.stringify(errorResponse('Session not found or access denied')),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build request body for send-channel-message
    const requestBody: any = {
      session_id,
      message,
      project_id
    };

    // Add sender information for SMS responses
    if (sessionData.channel_type === 'sms') {
      // Get agent phone number from company settings
      const { data: company } = await supabase
        .from('companies')
        .select('agent_phone_number')
        .eq('id', securityContext.company_id)
        .single();

      requestBody.sender = {
        phone: company?.agent_phone_number || '+18662439163'
      };
    }

    // Call send-channel-message function
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-channel-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[tool-channel-response] Error sending message:', errorText);
      return new Response(
        JSON.stringify(errorResponse(`Failed to send message: ${response.status}`, 'Could not deliver message')),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify(successResponse({
        channel_type: result.channel_type,
        communication_id: result.communication_id
      }, `Message sent successfully via ${result.channel_type}`)),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tool-channel-response] Error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message || 'Unknown error')),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
