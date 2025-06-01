import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const message = await parseRequestBody(req);
    console.log('Received Twilio chat webhook:', JSON.stringify(message, null, 2));

    if (!message.From || !message.Body) {
      throw new Error('Missing required fields: From and/or Body');
    }

    // Check if phone number is verified
    const authResult = await authenticatePhoneNumber(supabase, message.From);
    
    if (!authResult.authenticated) {
      await handleUnverifiedPhone(supabase, message.From, message.Body);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
      );
    }

    // Process the message with authenticated user context
    await processAuthenticatedMessage(supabase, message, authResult.userToken);

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
    );
  } catch (error) {
    console.error('Error processing chat webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function sendTwilioSMS(phoneNumber: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromPhone) {
    console.error('Missing Twilio credentials for SMS sending');
    throw new Error('Missing Twilio credentials');
  }

  // Format phone numbers (ensure they have the + prefix for E.164 format)
  const toPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const twilioFromPhone = fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`;

  // Prepare authorization for Twilio API
  const auth = btoa(`${accountSid}:${authToken}`);

  // Prepare the request body
  const formData = new URLSearchParams();
  formData.append('To', toPhone);
  formData.append('From', twilioFromPhone);
  formData.append('Body', message);

  // Make the API call to Twilio
  const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  console.log(`Sending Twilio SMS to ${toPhone}: ${message.substring(0, 50)}...`);

  const response = await fetch(twilioEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData
  });

  const responseText = await response.text();
  let responseData;

  try {
    responseData = JSON.parse(responseText);
  } catch (parseError) {
    console.error(`Error parsing Twilio response: ${parseError.message}`);
    throw new Error(`Twilio API response parsing error: ${parseError.message}`);
  }

  if (!response.ok) {
    console.error('Twilio API error:', responseData);
    throw new Error(`Twilio API error: ${responseData.message || responseData.error_message || 'Unknown error'}`);
  }

  console.log('Successfully sent SMS via Twilio:', responseData.sid);
  return responseData;
}

async function parseRequestBody(req: Request): Promise<Record<string, any>> {
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
      const text = await req.text();
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
  
  return requestBody;
}

async function authenticatePhoneNumber(supabase: any, phoneNumber: string) {
  // Check if phone number is verified
  const { data: verification } = await supabase
    .from('phone_verifications')
    .select('*, contacts(*)')
    .eq('phone_number', phoneNumber)
    .single();

  if (!verification?.verified_at) {
    return { authenticated: false };
  }

  // Check for valid token
  const { data: token } = await supabase
    .from('user_tokens')
    .select('*')
    .eq('contact_id', verification.contact_id)
    .gt('expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!token) {
    // Need to create new token
    const newToken = await createUserToken(supabase, verification.contacts);
    return { authenticated: true, userToken: newToken };
  }

  return { authenticated: true, userToken: token };
}

async function createUserToken(supabase: any, contact: any) {
  const tokenPayload = {
    contact_id: contact.id,
    company_id: contact.company_id,
    role: contact.role,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iat: Math.floor(Date.now() / 1000)
  };

  // Simple token creation (in production, use proper JWT)
  const tokenString = btoa(JSON.stringify(tokenPayload));
  
  const { data: newToken, error } = await supabase
    .from('user_tokens')
    .insert({
      contact_id: contact.id,
      token_hash: tokenString,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      scope: 'sms_verified'
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create token: ${error.message}`);
  }

  return newToken;
}

async function handleUnverifiedPhone(supabase: any, phoneNumber: string, messageBody: string) {
  console.log(`Handling unverified phone ${phoneNumber} with message: ${messageBody}`);
  
  // Check if this looks like an OTP
  const otpRegex = /^\d{6}$/;
  if (otpRegex.test(messageBody.trim())) {
    console.log(`Attempting to verify OTP: ${messageBody.trim()}`);
    
    // Try to verify the OTP
    try {
      const verifyResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/phone-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          verification_code: messageBody.trim(),
          action: 'verify_otp'
        })
      });

      const result = await verifyResponse.json();
      
      if (verifyResponse.ok) {
        console.log('OTP verification successful');
        // Send welcome message
        await sendSMS(supabase, phoneNumber, "Welcome! Your phone number has been verified. You can now ask me questions about your projects.");
      } else {
        console.log('OTP verification failed:', result.error);
        await sendSMS(supabase, phoneNumber, `Verification failed: ${result.error}. Please try again.`);
      }
    } catch (error) {
      console.error('Error during OTP verification:', error);
      await sendSMS(supabase, phoneNumber, "Sorry, there was an error verifying your code. Please try again.");
    }
  } else {
    console.log(`Requesting new OTP for ${phoneNumber}`);
    
    // Request OTP for new phone number
    try {
      const otpResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/phone-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          action: 'request_otp'
        })
      });

      const result = await otpResponse.json();
      
      if (otpResponse.ok) {
        console.log('OTP request successful');
        await sendSMS(supabase, phoneNumber, "Welcome! For security, please reply with the 6-digit verification code I just sent you.");
      } else {
        console.error('OTP request failed:', result.error);
        await sendSMS(supabase, phoneNumber, `Sorry, there was an error: ${result.error}. Please try again later.`);
      }
    } catch (error) {
      console.error('Error during OTP request:', error);
      await sendSMS(supabase, phoneNumber, "Sorry, there was an error processing your message. Please try again later.");
    }
  }
}

async function processAuthenticatedMessage(supabase: any, message: any, userToken: any) {
  const { From: from, Body: body } = message;
  
  // Get contact info from token
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', userToken.contact_id)
    .single();

  if (!contact) {
    throw new Error('Contact not found for authenticated user');
  }

  console.log(`Processing message from authenticated contact: ${contact.full_name} (${contact.id})`);

  // Log the message interaction
  await supabase
    .from('audit_log')
    .insert({
      contact_id: contact.id,
      company_id: contact.company_id,
      action: 'sms_received',
      resource_type: 'communication',
      details: { phone_number: from, message_length: body.length }
    });

  // Get or create chat session using the database function directly
  const session = await getOrCreateChatSession(supabase, from, body, contact);
  
  // Add the user's message to session history
  await addMessageToSessionHistory(supabase, session.id, 'user', body);
  
  // Get the full conversation history for context
  const conversationHistory = await getConversationHistory(supabase, session.id);
  
  // Process the message with AI agent using user context
  const assistantMessage = await processMessageWithAgent(supabase, session.id, conversationHistory, userToken);
  console.log(`Agent response: ${assistantMessage}`);
  
  // Add the assistant's response to session history
  await addMessageToSessionHistory(supabase, session.id, 'assistant', assistantMessage);
  
  // Send the response back to the user
  await sendDirectChannelResponse(supabase, session.id, assistantMessage);
}

async function getOrCreateChatSession(supabase: any, from: string, body: string, contact: any) {
  try {
    console.log(`Creating chat session for contact ${contact.id} from ${from}`);
    
    // Use the database function directly instead of calling the edge function
    const { data: sessionId, error } = await supabase.rpc('find_or_create_chat_session', {
      p_channel_type: 'sms',
      p_channel_identifier: from,
      p_company_id: contact.company_id,
      p_contact_id: contact.id,
      p_project_id: null, // Will be determined later by the AI agent
      p_memory_mode: 'standard'
    });
    
    if (error) {
      console.error('Error creating chat session:', error);
      throw new Error(`Failed to create chat session: ${error.message}`);
    }
    
    // Get the full session data
    const { data: session, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching session details:', fetchError);
      throw new Error(`Failed to fetch session: ${fetchError.message}`);
    }
    
    console.log(`Chat session retrieved/created with ID: ${session.id}`);
    return session;
  } catch (error) {
    console.error('Error in getOrCreateChatSession:', error);
    throw error;
  }
}

async function getConversationHistory(userSupabase: any, sessionId: string) {
  try {
    const { data: session, error } = await userSupabase
      .from('chat_sessions')
      .select('conversation_history')
      .eq('id', sessionId)
      .single();
      
    if (error || !session) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
    
    const history = session.conversation_history || [];
    console.log(`Retrieved ${history.length} messages from conversation history`);
    
    return history.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));
  } catch (error) {
    console.error('Exception in getConversationHistory:', error);
    return [];
  }
}

async function addMessageToSessionHistory(userSupabase: any, sessionId: string, role: 'user' | 'assistant', content: string) {
  try {
    const { error } = await userSupabase.rpc('update_session_history', {
      p_session_id: sessionId, 
      p_role: role, 
      p_content: content
    });
    
    if (error) {
      console.error('Error updating session history:', error);
    }
  } catch (error) {
    console.error('Exception in addMessageToSessionHistory:', error);
  }
}

async function processMessageWithAgent(userSupabase: any, sessionId: string, conversationHistory: any[], userToken: any) {
  try {
    const messages = [
      { 
        role: 'system', 
        content: 'You are a helpful assistant responding to text messages. Be concise and helpful. Use people\'s first names when communicating with them - Talk casual and friendly!' 
      },
      ...conversationHistory
    ];
    
    console.log(`Sending ${messages.length} messages to agent-chat (including system prompt)`);
    
    const agentResponse = await userSupabase.functions.invoke('agent-chat', {
      body: {
        messages: messages,
        availableTools: ['session_manager', 'identify_project', 'data_fetch', 'channel_response'],
        customPrompt: `You are responding to an SMS message. Be concise and provide clear information.
Current session: ${sessionId}
Keep responses conversational and friendly, using first names when appropriate.`,
        userId: userToken.contact_id // Pass the contact_id as userId for RLS context
      }
    });
    
    if (!agentResponse.data) {
      throw new Error('Failed to process message with agent-chat');
    }
    
    return agentResponse.data.choices[0].message.content;
  } catch (error) {
    console.error('Error in processMessageWithAgent:', error);
    return "I'm sorry, I encountered an error processing your message. Please try again later.";
  }
}

async function sendDirectChannelResponse(userSupabase: any, sessionId: string, assistantMessage: string) {
  try {
    const channelResponse = await userSupabase.functions.invoke('send-channel-message', {
      body: {
        session_id: sessionId,
        message: assistantMessage
      }
    });
    
    if (!channelResponse.data) {
      throw new Error('Failed to send message');
    }
    
    console.log(`Message sent successfully via ${channelResponse.data.channel_type}`, channelResponse.data);
  } catch (error) {
    console.error('Error in sendDirectChannelResponse:', error);
  }
}

async function sendSMS(supabase: any, phoneNumber: string, message: string) {
  try {
    // Actually send SMS via Twilio instead of just logging
    await sendTwilioSMS(phoneNumber, message);
    
    // Log the outbound message
    await supabase
      .from('audit_log')
      .insert({
        action: 'sms_sent',
        resource_type: 'communication',
        details: { 
          phone_number: phoneNumber, 
          message_length: message.length,
          message_type: 'system_response'
        }
      });
  } catch (error) {
    console.error('Error sending SMS:', error);
    // Also log the failed attempt
    await supabase
      .from('audit_log')
      .insert({
        action: 'sms_send_failed',
        resource_type: 'communication',
        details: { 
          phone_number: phoneNumber, 
          error: error.message,
          message_type: 'system_response'
        }
      });
  }
}
