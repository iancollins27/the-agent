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

interface ChannelMessageRequest {
  session_id: string;
  message: string;
  project_id?: string;
  sender?: {
    phone?: string;
    email?: string;
    name?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }
  
  // Note: JWT verification is disabled in config.toml for internal calls
  // This function is called internally by chat-webhook-twilio and agent-chat

  try {
    const { session_id, message, project_id, sender } = await req.json() as ChannelMessageRequest;

    // Validate required fields
    if (!session_id || !message) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          message: "session_id and message are required"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError);
      return new Response(
        JSON.stringify({
          error: "Session not found",
          message: sessionError?.message || "Could not retrieve session data"
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Add message to session history
    const history = session.conversation_history || [];
    history.push({
      role: 'assistant',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Update session
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({
        conversation_history: history,
        last_activity: new Date().toISOString(),
        project_id: project_id || session.project_id // Update project_id if provided
      })
      .eq('id', session_id);

    if (updateError) {
      console.error('Error updating session:', updateError);
      // Continue despite error - we still want to send the message
    }

    // Send message based on channel type
    let communicationId: string | null = null;
    
    switch (session.channel_type) {
      case 'sms':
        // Use send-communication for SMS
        communicationId = await sendSmsMessage(session, message, sender);
        break;
        
      case 'email':
        // Use send-communication for Email
        communicationId = await sendEmailMessage(session, message, sender);
        break;
        
      case 'web':
        // Web sessions are handled by the frontend; just update the session
        console.log('Web channel message - no need to send via external provider');
        break;
        
      default:
        return new Response(
          JSON.stringify({
            error: "Unsupported channel type",
            message: `Channel type '${session.channel_type}' is not supported for sending messages`
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

    // Check if SMS sending failed (communicationId is null for SMS channel)
    if (session.channel_type === 'sms' && communicationId === null) {
      console.error('SMS send failed - communication_id is null');
      return new Response(
        JSON.stringify({
          error: "Failed to send SMS",
          message: "The SMS could not be sent via send-communication"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: "Message sent successfully",
        session_id,
        channel_type: session.channel_type,
        communication_id: communicationId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in send-channel-message function:', error);
    
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

async function sendSmsMessage(session: any, message: string, sender?: any): Promise<string | null> {
  try {
    // Get contact details if available
    let recipient = {
      id: session.contact_id || null,
      phone: session.channel_identifier,
      name: session.channel_identifier // Default to phone number if name not available
    };
    
    // If contact_id is available, get more details
    if (session.contact_id) {
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, full_name, phone_number')
        .eq('id', session.contact_id)
        .single();
        
      if (!contactError && contact) {
        recipient = {
          id: contact.id,
          phone: contact.phone_number || session.channel_identifier,
          name: contact.full_name
        };
      }
    }
    
    // Prepare request body for send-communication
    const requestBody: any = {
      projectId: session.project_id || null,
      channel: 'SMS',
      messageContent: message,
      recipient,
      sender: sender || null
    };

    // If sender is provided (agent response), force Twilio provider
    if (sender && sender.phone) {
      console.log('Agent SMS response - forcing Twilio provider');
      requestBody.providerId = 'twilio'; // Use providerId instead of providerInfo
    }
    // For non-agent responses, let the system choose the appropriate provider automatically
    // Don't set any provider info - let the normal provider selection logic handle it
    
    // Use send-communication function to send SMS
    const response = await fetch(`${supabaseUrl}/functions/v1/send-communication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error('Error sending SMS message:', await response.text());
      return null;
    }

    const result = await response.json();
    return result.communication_id || null;
  } catch (error) {
    console.error('Error in sendSmsMessage:', error);
    return null;
  }
}

async function sendEmailMessage(session: any, message: string, sender?: any): Promise<string | null> {
  try {
    // Get contact details if available
    let recipient = {
      id: session.contact_id || null,
      email: session.channel_identifier,
      name: session.channel_identifier.split('@')[0] // Default to email prefix if name not available
    };
    
    // If contact_id is available, get more details
    if (session.contact_id) {
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id, full_name, email')
        .eq('id', session.contact_id)
        .single();
        
      if (!contactError && contact) {
        recipient = {
          id: contact.id,
          email: contact.email || session.channel_identifier,
          name: contact.full_name
        };
      }
    }
    
    // Create communication record directly since email sending is not fully implemented
    const { data: commRecord, error: commError } = await supabase
      .from('communications')
      .insert({
        type: 'EMAIL',
        subtype: 'email_message',
        direction: 'OUTBOUND',
        content: message,
        timestamp: new Date().toISOString(),
        participants: [
          {
            type: 'recipient',
            contact_id: recipient.id,
            name: recipient.name,
            email: recipient.email
          }
        ],
        provider: 'email',
        status: 'PENDING',
        project_id: session.project_id,
        session_id: session.id
      })
      .select()
      .single();

    if (commError) {
      console.error('Error creating email communication record:', commError);
      return null;
    }
    
    // TODO: Implement actual email sending once the appropriate provider is configured
    console.log('Email sending not fully implemented - created communication record only');
    
    return commRecord.id;
  } catch (error) {
    console.error('Error in sendEmailMessage:', error);
    return null;
  }
}
