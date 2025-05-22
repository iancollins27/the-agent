
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Parse incoming request body based on content type
 */
async function parseRequestBody(req: Request): Promise<Record<string, any>> {
  const contentType = req.headers.get('content-type') || '';
  let requestBody: Record<string, any> = {};
  
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
  
  return requestBody;
}

/**
 * Create or retrieve a chat session
 */
async function getOrCreateChatSession(
  from: string,
  body: string,
  companyId: string = '00000000-0000-0000-0000-000000000000'
): Promise<{ id: string }> {
  const sessionResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/chat-session-manager`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
    },
    body: JSON.stringify({
      channel_type: 'sms',
      channel_identifier: from,
      company_id: companyId,
      message_content: body
    })
  });
  
  if (!sessionResponse.ok) {
    const errorText = await sessionResponse.text();
    console.error('Error creating session:', errorText);
    throw new Error('Failed to create chat session');
  }
  
  const sessionData = await sessionResponse.json();
  console.log(`Chat session retrieved/created with ID: ${sessionData.session.id}`);
  return sessionData.session;
}

/**
 * Update the session history with a new message
 */
async function addMessageToSessionHistory(
  supabase: ReturnType<typeof createClient>,
  sessionId: string, 
  role: 'user' | 'assistant', 
  content: string
): Promise<void> {
  const { error } = await supabase.rpc('update_session_history', {
    p_session_id: sessionId, 
    p_role: role, 
    p_content: content
  });
  
  if (error) {
    console.error('Error updating session history:', error);
    // Continue despite error - we want to process the message anyway
  }
}

/**
 * Process user message with the AI agent
 */
async function processMessageWithAgent(
  sessionId: string,
  userMessage: string
): Promise<string> {
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
          content: userMessage 
        }
      ],
      availableTools: ['session_manager', 'channel_response', 'identify_project', 'data_fetch'],
      customPrompt: `You are responding to an SMS message. Be concise and provide clear information.
Current session: ${sessionId}
Message: ${userMessage}`
    })
  });
  
  if (!agentResponse.ok) {
    const errorText = await agentResponse.text();
    console.error('Error calling agent-chat:', errorText);
    throw new Error('Failed to process message with agent-chat');
  }
  
  const agentData = await agentResponse.json();
  return agentData.choices[0].message.content;
}

/**
 * Send the AI response back to the user via the channel_response tool
 */
async function sendResponseViaChannel(sessionId: string, assistantMessage: string): Promise<void> {
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
}

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

    // Parse request body
    const requestBody = await parseRequestBody(req);
    console.log('Received Twilio chat webhook:', JSON.stringify(requestBody, null, 2));

    // Extract message information
    const from = requestBody.From; // The sender's phone number
    const body = requestBody.Body;  // The message content
    const to = requestBody.To;     // The Twilio phone number that received the message

    if (!from || !body) {
      throw new Error('Missing required fields: From and/or Body');
    }

    // Get or create a chat session
    const session = await getOrCreateChatSession(from, body);
    
    // Add the user's message to the session history
    await addMessageToSessionHistory(supabase, session.id, 'user', body);
    
    // Process the message with agent-chat
    const assistantMessage = await processMessageWithAgent(session.id, body);
    console.log(`Agent response: ${assistantMessage}`);
    
    // Add the assistant's message to the session history
    await addMessageToSessionHistory(supabase, session.id, 'assistant', assistantMessage);
    
    // Send the response back via the channel_response tool
    await sendResponseViaChannel(session.id, assistantMessage);

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
