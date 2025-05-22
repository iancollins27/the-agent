
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body based on content type
    let requestBody: Record<string, any> = {};
    const contentType = req.headers.get('content-type') || '';
    
    try {
      if (contentType.includes('application/json')) {
        requestBody = await req.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        for (const [key, value] of formData.entries()) {
          requestBody[key] = value;
        }
      } else {
        // Handle text or missing content type
        const text = await req.text();
        
        // Try to parse as URL encoded params
        try {
          const params = new URLSearchParams(text);
          for (const [key, value] of params.entries()) {
            requestBody[key] = value;
          }
        } catch (parseError) {
          console.error('Error parsing request as URL params:', parseError);
        }
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
    }
    
    console.log('Received Twilio chat webhook:', JSON.stringify(requestBody, null, 2));

    // Extract the important information from the Twilio webhook
    const from = requestBody.From; // The sender's phone number
    const body = requestBody.Body;  // The message content
    const to = requestBody.To;     // The Twilio phone number that received the message

    if (!from || !body) {
      throw new Error('Missing required fields: From and/or Body');
    }

    // Get or create a chat session
    const sessionResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-session-manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        channel_type: 'sms',
        channel_identifier: from,
        company_id: '00000000-0000-0000-0000-000000000000', // Default company ID - adjust as needed
        message_content: body
      })
    });
    
    if (!sessionResponse.ok) {
      console.error('Error creating session:', await sessionResponse.text());
      throw new Error('Failed to create chat session');
    }
    
    const sessionData = await sessionResponse.json();
    const sessionId = sessionData.session.id;
    
    console.log(`Chat session retrieved/created with ID: ${sessionId}`);
    
    // Add the user's message to the session history
    const { error: historyError } = await supabase.rpc('update_session_history', {
      p_session_id: sessionId, 
      p_role: 'user', 
      p_content: body
    });
    
    if (historyError) {
      console.error('Error updating session history:', historyError);
      // Continue despite error - we want to process the message
    }

    // Call the agent-chat function with the user's message
    const agentResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant responding to text messages. Be concise and helpful.' 
          },
          { 
            role: 'user', 
            content: body 
          }
        ],
        availableTools: ['session_manager', 'channel_response', 'identify_project', 'data_fetch'],
        customPrompt: `You are responding to an SMS message. Be concise and provide clear information.
Current session: ${sessionId}
From: ${from}
Message: ${body}`
      })
    });
    
    if (!agentResponse.ok) {
      console.error('Error calling agent-chat:', await agentResponse.text());
      throw new Error('Failed to process message with agent-chat');
    }
    
    const agentData = await agentResponse.json();
    const assistantMessage = agentData.choices[0].message.content;
    
    console.log(`Agent response: ${assistantMessage}`);
    
    // Use the channel_response tool to send the message back
    const channelResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'system', 
            content: `You're a tool executor. Use the channel_response tool to send this message: "${assistantMessage}"` 
          },
          { 
            role: 'user', 
            content: `Send this message to session ${sessionId}: ${assistantMessage}` 
          }
        ],
        availableTools: ['channel_response'],
      })
    });
    
    if (!channelResponse.ok) {
      console.error('Error using channel_response tool:', await channelResponse.text());
    }

    // Respond to Twilio with TwiML
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/xml' 
        } 
      }
    );
  } catch (error) {
    console.error('Error processing chat webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
