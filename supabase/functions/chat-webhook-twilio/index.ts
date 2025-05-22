
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types for better code organization
interface TwilioMessage {
  From: string;
  Body: string;
  To: string;
  [key: string]: any;
}

interface ChatSession {
  id: string;
  [key: string]: any;
}

/**
 * Process an incoming Twilio webhook request
 */
async function handleTwilioWebhook(req: Request): Promise<Response> {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the incoming message
    const message = await parseRequestBody(req);
    console.log('Received Twilio chat webhook:', JSON.stringify(message, null, 2));

    // Validate required fields
    if (!message.From || !message.Body) {
      throw new Error('Missing required fields: From and/or Body');
    }

    // Process the message through the conversation flow
    await processMessage(supabase, message);

    // Return TwiML response (empty response as we're handling async)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
    );
  } catch (error) {
    console.error('Error processing chat webhook:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}

/**
 * Parse the incoming request body based on content type
 */
async function parseRequestBody(req: Request): Promise<TwilioMessage> {
  const contentType = req.headers.get('content-type') || '';
  const requestBody: Record<string, any> = {};
  
  try {
    if (contentType.includes('application/json')) {
      Object.assign(requestBody, await req.json());
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
    throw new Error(`Failed to parse request: ${parseError.message}`);
  }
  
  return requestBody as TwilioMessage;
}

/**
 * Main message processing workflow
 */
async function processMessage(
  supabase: ReturnType<typeof createClient>, 
  message: TwilioMessage
): Promise<void> {
  const { From: from, Body: body } = message;
  
  // Default company ID - in production, you'd determine this based on the Twilio number or other context
  const companyId = '00000000-0000-0000-0000-000000000000';

  // Step 1: Get or create chat session
  const session = await getOrCreateChatSession(from, body, companyId);
  
  // Step 2: Add the user's message to session history
  await addMessageToSessionHistory(supabase, session.id, 'user', body);
  
  // Step 3: Process the message with AI agent
  const assistantMessage = await processMessageWithAgent(session.id, body);
  console.log(`Agent response: ${assistantMessage}`);
  
  // Step 4: Add the assistant's response to session history
  await addMessageToSessionHistory(supabase, session.id, 'assistant', assistantMessage);
  
  // Step 5: Send the response directly via send-channel-message function
  await sendDirectChannelResponse(session.id, assistantMessage);
}

/**
 * Get or create a chat session
 */
async function getOrCreateChatSession(
  from: string,
  body: string,
  companyId: string = '00000000-0000-0000-0000-000000000000'
): Promise<ChatSession> {
  try {
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
  } catch (error) {
    console.error('Error in getOrCreateChatSession:', error);
    throw error; // Re-throw to be handled by the main error handler
  }
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
  try {
    const { error } = await supabase.rpc('update_session_history', {
      p_session_id: sessionId, 
      p_role: role, 
      p_content: content
    });
    
    if (error) {
      console.error('Error updating session history:', error);
      // Log error but continue processing - we don't want to break the flow
    }
  } catch (error) {
    console.error('Exception in addMessageToSessionHistory:', error);
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
  try {
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
        availableTools: ['session_manager', 'identify_project', 'data_fetch', 'channel_response'],
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
  } catch (error) {
    console.error('Error in processMessageWithAgent:', error);
    return "I'm sorry, I encountered an error processing your message. Please try again later.";
  }
}

/**
 * Send the AI response back to the user via the direct channel_response 
 * Instead of using agent-chat to invoke channel_response tool, we call send-channel-message directly
 */
async function sendDirectChannelResponse(sessionId: string, assistantMessage: string): Promise<void> {
  try {
    const channelResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-channel-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: assistantMessage
      })
    });
    
    if (!channelResponse.ok) {
      const errorText = await channelResponse.text();
      console.error('Error sending channel message:', errorText);
      throw new Error(`Failed to send message: ${channelResponse.status}`);
    }
    
    const result = await channelResponse.json();
    console.log(`Message sent successfully via ${result.channel_type}`, result);
  } catch (error) {
    console.error('Error in sendDirectChannelResponse:', error);
    // Log but don't throw - this is the last step and we don't want to break the flow
  }
}

// Main entry point
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  return handleTwilioWebhook(req);
});
