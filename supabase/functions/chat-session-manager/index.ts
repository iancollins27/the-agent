
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SessionRequest {
  channel_type: 'web' | 'sms' | 'email';
  channel_identifier: string;
  contact_id?: string;
  company_id: string;
  project_id?: string;
  memory_mode?: 'standard' | 'detailed';
  message_content?: string;
  communication_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }
  
  // Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ 
        error: 'Missing or invalid authorization header',
        message: 'This endpoint requires authentication'
      }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { 
      channel_type, 
      channel_identifier, 
      contact_id,
      company_id, 
      project_id,
      memory_mode,
      message_content,
      communication_id
    } = await req.json() as SessionRequest;

    // Validate required fields
    if (!channel_type || !channel_identifier || !company_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          message: "channel_type, channel_identifier, and company_id are required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find or create session using the DB function
    const { data: sessionData, error: sessionError } = await supabase.rpc(
      'find_or_create_chat_session',
      {
        p_channel_type: channel_type,
        p_channel_identifier: channel_identifier,
        p_contact_id: contact_id,
        p_company_id: company_id,
        p_project_id: project_id,
        p_memory_mode: memory_mode || 'standard'
      }
    );

    if (sessionError) {
      console.error('Error finding/creating session:', sessionError);
      return new Response(
        JSON.stringify({
          error: sessionError.message,
          message: "Failed to create or find chat session"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // If communication_id is provided, link it to this session
    if (communication_id) {
      const { error: updateError } = await supabase
        .from('communications')
        .update({ session_id: sessionData })
        .eq('id', communication_id);

      if (updateError) {
        console.error('Error linking communication to session:', updateError);
        // Continue despite error - the session is still valid
      }
    }

    // Get the full session data to return to the client
    const { data: fullSession, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionData)
      .single();

    if (fetchError) {
      console.error('Error fetching session details:', fetchError);
      return new Response(
        JSON.stringify({
          error: fetchError.message,
          message: "Session was created but details could not be fetched",
          session_id: sessionData
        }),
        {
          status: 200, // Still return 200 as the core operation succeeded
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Return the session data to the client
    return new Response(
      JSON.stringify({
        message: "Chat session retrieved or created successfully",
        session: fullSession
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in chat-session-manager function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
