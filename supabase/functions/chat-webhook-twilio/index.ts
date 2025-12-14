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

    // Get or create contact and user token (no OTP required)
    const authResult = await getOrCreateUserToken(supabase, message.From);
    
    if (!authResult.userToken) {
      console.error('Failed to get or create user token');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
      );
    }

    // Process the message with user context
    try {
      await processAuthenticatedMessage(supabase, message, authResult.userToken);
    } catch (processError) {
      console.error('Error in processAuthenticatedMessage:', processError);
      // Try to send an error message to the user
      try {
        await sendSMS(supabase, message.From, "I'm sorry, I encountered an error processing your message. Please try again.");
      } catch (smsError) {
        console.error('Error sending error message:', smsError);
      }
      // Return 200 to prevent Twilio from retrying and sending duplicate error messages
      // The user has already been notified via SMS
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } }
      );
    }

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

async function getOrCreateUserToken(supabase: any, phoneNumber: string) {
  // Get or create contact for this phone number
  let contact = await getOrCreateContact(supabase, phoneNumber);
  
  if (!contact) {
    console.error(`Failed to get or create contact for ${phoneNumber}`);
    return { userToken: null };
  }

  // Check for valid token
  const { data: token, error: tokenError } = await supabase
    .from('user_tokens')
    .select('*')
    .eq('contact_id', contact.id)
    .gt('expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenError) {
    console.error('Error checking for existing token:', tokenError);
  }

  if (token) {
    return { userToken: token };
  }

  // Create new token - double check contact is valid
  if (!contact || !contact.id) {
    console.error('Cannot create token: contact is invalid', contact);
    return { userToken: null };
  }
  
  try {
    const newToken = await createUserToken(supabase, contact);
    return { userToken: newToken };
  } catch (tokenError) {
    console.error('Error creating user token:', tokenError);
    return { userToken: null };
  }
}

async function getOrCreateContact(supabase: any, phoneNumber: string) {
  // Normalize phone number for consistent searching
  // Ensure it has the + prefix (E.164 format)
  const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  
  console.log(`Looking up contact for phone: ${normalizedPhone}`);
  
  // Extract all possible format variations
  const phoneWithoutPlus = normalizedPhone.startsWith('+') ? normalizedPhone.substring(1) : normalizedPhone;
  const digitsOnly = normalizedPhone.replace(/\D/g, '');
  const last10Digits = digitsOnly.length >= 10 ? digitsOnly.substring(digitsOnly.length - 10) : digitsOnly;
  const last10DigitsWithPlus = `+1${last10Digits}`;
  
  // Build OR query to search all formats at once
  const formatConditions = [
    `phone_number.eq.${normalizedPhone}`,
    `phone_number.eq.${phoneWithoutPlus}`
  ];
  
  // Add 10-digit variations for US numbers
  if (normalizedPhone.startsWith('+1') && normalizedPhone.length === 12) {
    formatConditions.push(`phone_number.eq.${last10Digits}`);
  }
  
  // Add ILIKE patterns for partial matching
  formatConditions.push(`phone_number.ilike.%${last10Digits}%`);
  if (digitsOnly.length > 10) {
    formatConditions.push(`phone_number.ilike.%${digitsOnly}%`);
  }
  
  // Try comprehensive OR query first
  const orQuery = formatConditions.join(',');
  console.log(`Searching with OR query: ${orQuery.substring(0, 100)}...`);
  
  let { data: existingContacts, error: lookupError } = await supabase
    .from('contacts')
    .select('*')
    .or(orQuery)
    .limit(10); // Get multiple in case of duplicates
  
  if (lookupError) {
    console.error('Error in OR query lookup:', lookupError);
    // Fallback to individual queries
    existingContacts = null;
  }

  // If OR query didn't work or returned nothing, try individual exact matches
  if (!existingContacts || existingContacts.length === 0) {
    console.log(`OR query found nothing, trying individual format searches...`);
    
    // Try exact matches one by one
    const formatsToTry = [
      { format: normalizedPhone, name: 'normalized (+ prefix)' },
      { format: phoneWithoutPlus, name: 'without + prefix' }
    ];
    
    if (normalizedPhone.startsWith('+1') && normalizedPhone.length === 12) {
      formatsToTry.push({ format: last10Digits, name: 'last 10 digits' });
    }
    
    for (const { format, name } of formatsToTry) {
      if (existingContacts && existingContacts.length > 0) break;
      
      console.log(`Trying exact match: ${name} (${format})`);
      const { data: altContacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone_number', format)
        .limit(1);
      
      if (altContacts && altContacts.length > 0) {
        existingContacts = altContacts;
        console.log(`Found contact using ${name} format`);
        break;
      }
    }
  }

  if (existingContacts && existingContacts.length > 0) {
    // If multiple contacts found, prefer the one with normalized format, otherwise take first
    const preferred = existingContacts.find(c => c.phone_number === normalizedPhone) || existingContacts[0];
    console.log(`Found existing contact: ${preferred.id} (${preferred.full_name || 'Unnamed'})`);
    console.log(`Contact phone_number in DB: ${preferred.phone_number}`);
    
    // If the stored format differs from normalized, log it (but don't update automatically to avoid data changes)
    if (preferred.phone_number !== normalizedPhone) {
      console.log(`Note: Contact phone format in DB (${preferred.phone_number}) differs from normalized format (${normalizedPhone})`);
    }
    
    return preferred;
  }

  // No existing contact found - create new one
  // But first, try one more comprehensive search to be absolutely sure
  console.log(`No contact found after exhaustive search. Creating new contact for phone number: ${normalizedPhone}`);
  
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      phone_number: normalizedPhone, // Use normalized format for consistency
      full_name: `User ${normalizedPhone}`,
      role: 'HO' // Use 'HO' to match the filter in resolveContactAndCompany
    })
    .select()
    .single();

  if (error) {
    // If insert fails due to duplicate (unique constraint violation), retry comprehensive lookup
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      console.log(`Insert failed due to duplicate - contact may already exist. Retrying comprehensive lookup...`);
      
      // Retry with the same comprehensive search we did before
      const retryOrQuery = formatConditions.join(',');
      const { data: retryContacts } = await supabase
        .from('contacts')
        .select('*')
        .or(retryOrQuery)
        .limit(10);
      
      if (retryContacts && retryContacts.length > 0) {
        const preferred = retryContacts.find(c => c.phone_number === normalizedPhone) || retryContacts[0];
        console.log(`Found existing contact on retry: ${preferred.id}`);
        return preferred;
      }
      
      // If OR query didn't work, try individual formats
      for (const format of [normalizedPhone, phoneWithoutPlus, last10Digits].filter(f => f)) {
        const { data: altContacts } = await supabase
          .from('contacts')
          .select('*')
          .eq('phone_number', format)
          .limit(1);
        
        if (altContacts && altContacts.length > 0) {
          console.log(`Found existing contact on retry with format: ${format}`);
          return altContacts[0];
        }
      }
    }
    console.error('Error creating contact:', error);
    return null;
  }

  if (!newContact || !newContact.id) {
    console.error('Contact created but returned null or missing id:', newContact);
    return null;
  }

  console.log(`Successfully created new contact: ${newContact.id}`);
  return newContact;
}

async function createUserToken(supabase: any, contact: any) {
  // Validate contact is not null/undefined
  if (!contact || !contact.id) {
    console.error('createUserToken called with invalid contact:', contact);
    throw new Error('Cannot create token: contact is null or missing id');
  }

  const tokenPayload = {
    contact_id: contact.id,
    company_id: contact.company_id || null,
    role: contact.role || 'HO',
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

// OTP feature removed - unverified phones can now interact directly with the agent

async function processAuthenticatedMessage(supabase: any, message: any, userToken: any) {
  const { From: from, Body: body } = message;
  
  // Check if this is a company selection response
  if (await handleCompanySelection(supabase, from, body)) {
    return; // Company selection was handled
  }

  // Check if this is a project selection response
  if (await handleProjectSelection(supabase, from, body)) {
    return; // Project selection was handled
  }

  // Get the appropriate contact and company for this session
  const contactAndCompany = await resolveContactAndCompany(supabase, from, body);
  
  if (!contactAndCompany) {
    // If contact exists but has no company/project, use the contact from the token
    // This handles cases where a new contact was just created or has no company association
    const { data: contactFromToken, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', userToken.contact_id)
      .maybeSingle();
    
    if (contactError) {
      console.error('Error fetching contact from token:', contactError);
    }
    
    if (contactFromToken) {
      console.log(`Using contact from token (no company/project found): ${contactFromToken.id}`);
      // Use the contact from token, even if it doesn't have a company_id
      // The agent can still respond, it just won't have company context
      const session = await getOrCreateChatSession(
        supabase, 
        from, 
        body, 
        contactFromToken, 
        contactFromToken.company_id || null, 
        null
      );
      
      // Log the message interaction
      await supabase
        .from('audit_log')
        .insert({
          contact_id: contactFromToken.id,
          company_id: contactFromToken.company_id || null, // Normalize undefined to null for consistency
          action: 'sms_received',
          resource_type: 'communication',
          details: { phone_number: from, message_length: body.length }
        });
      
      await addMessageToSessionHistory(supabase, session.id, 'user', body);
      const conversationHistory = await getConversationHistory(supabase, session.id);
      const assistantMessage = await processMessageWithAgent(supabase, session.id, conversationHistory, userToken);
      console.log(`Agent response: ${assistantMessage}`);
      await addMessageToSessionHistory(supabase, session.id, 'assistant', assistantMessage);
      await sendDirectChannelResponse(supabase, session.id, assistantMessage);
      return;
    }
    
    console.error(`Could not find contact ${userToken.contact_id} from token`);
    await sendSMS(supabase, from, "Sorry, I couldn't find your contact information. Please try again.");
    return;
  }

  const { contact, companyId, projectId } = contactAndCompany;

  console.log(`Processing message from authenticated contact: ${contact.full_name} (${contact.id}) for company: ${companyId}${projectId ? ` and project: ${projectId}` : ''}`);

  // Log the message interaction
  await supabase
    .from('audit_log')
    .insert({
      contact_id: contact.id,
      company_id: companyId,
      action: 'sms_received',
      resource_type: 'communication',
      details: { phone_number: from, message_length: body.length }
    });

  // Get or create chat session using the database function directly
  const session = await getOrCreateChatSession(supabase, from, body, contact, companyId, projectId);
  
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

async function handleProjectSelection(supabase: any, phoneNumber: string, messageBody: string): Promise<boolean> {
  // Check if this is a numeric response (project selection)
  const numericResponse = messageBody.trim();
  if (!/^\d+$/.test(numericResponse)) {
    return false; // Not a numeric response
  }

  // Check if we have a pending project selection for this phone number
  const { data: pendingSelection, error: selectionError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('channel_type', 'sms')
    .eq('channel_identifier', phoneNumber)
    .eq('memory_mode', 'project_selection')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectionError) {
    console.error('Error checking for pending project selection:', selectionError);
  }

  if (!pendingSelection) {
    return false; // No pending project selection
  }

  // Get the project options that were presented to the user
  const projectCompanies = pendingSelection.conversation_history?.[0]?.projectCompanies || [];
  const selectedIndex = parseInt(numericResponse) - 1;

  if (selectedIndex < 0 || selectedIndex >= projectCompanies.length) {
    await sendSMS(supabase, phoneNumber, `Invalid selection. Please reply with a number between 1 and ${projectCompanies.length}.`);
    return true;
  }

  const selectedProjectCompany = projectCompanies[selectedIndex];

  // Create a new chat session with the selected project and company
  const { data: sessionId } = await supabase.rpc('find_or_create_chat_session', {
    p_channel_type: 'sms',
    p_channel_identifier: phoneNumber,
    p_company_id: selectedProjectCompany.companyId,
    p_contact_id: selectedProjectCompany.contactId,
    p_project_id: selectedProjectCompany.projectId,
    p_memory_mode: 'standard'
  });

  // Delete the project selection session
  await supabase
    .from('chat_sessions')
    .update({ active: false })
    .eq('id', pendingSelection.id);

  await sendSMS(supabase, phoneNumber, `Great! You're now connected to ${selectedProjectCompany.projectName} with ${selectedProjectCompany.companyName}. How can I help you today?`);
  
  return true;
}

async function handleCompanySelection(supabase: any, phoneNumber: string, messageBody: string): Promise<boolean> {
  // Check if this is a numeric response (company selection)
  const numericResponse = messageBody.trim();
  if (!/^\d+$/.test(numericResponse)) {
    return false; // Not a numeric response
  }

  // Check if we have a pending company selection for this phone number
  const { data: pendingSelection, error: selectionError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('channel_type', 'sms')
    .eq('channel_identifier', phoneNumber)
    .eq('memory_mode', 'company_selection')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectionError) {
    console.error('Error checking for pending company selection:', selectionError);
  }

  if (!pendingSelection) {
    return false; // No pending company selection
  }

  // Get the companies that were presented to the user
  const companies = pendingSelection.conversation_history?.[0]?.companies || [];
  const selectedIndex = parseInt(numericResponse) - 1;

  if (selectedIndex < 0 || selectedIndex >= companies.length) {
    await sendSMS(supabase, phoneNumber, `Invalid selection. Please reply with a number between 1 and ${companies.length}.`);
    return true;
  }

  const selectedCompany = companies[selectedIndex];

  // Create a new chat session with the selected company
  const { data: sessionId } = await supabase.rpc('find_or_create_chat_session', {
    p_channel_type: 'sms',
    p_channel_identifier: phoneNumber,
    p_company_id: selectedCompany.id,
    p_contact_id: selectedCompany.contact_id,
    p_project_id: null,
    p_memory_mode: 'standard'
  });

  // Delete the company selection session
  await supabase
    .from('chat_sessions')
    .update({ active: false })
    .eq('id', pendingSelection.id);

  await sendSMS(supabase, phoneNumber, `Great! You're now connected to ${selectedCompany.name}. How can I help you today?`);
  
  return true;
}

async function resolveContactAndCompany(supabase: any, phoneNumber: string, messageBody: string) {
  // Normalize phone number to match the format used in getOrCreateContact (E.164 format)
  const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  
  // Extract format variations for comprehensive search (same as getOrCreateContact)
  const phoneWithoutPlus = normalizedPhone.startsWith('+') ? normalizedPhone.substring(1) : normalizedPhone;
  const digitsOnly = normalizedPhone.replace(/\D/g, '');
  const last10Digits = digitsOnly.length >= 10 ? digitsOnly.substring(digitsOnly.length - 10) : digitsOnly;
  
  // Build OR query to search all formats (same approach as getOrCreateContact)
  const formatConditions = [
    `phone_number.eq.${normalizedPhone}`,
    `phone_number.eq.${phoneWithoutPlus}`
  ];
  
  // Add 10-digit variations for US numbers
  if (normalizedPhone.startsWith('+1') && normalizedPhone.length === 12) {
    formatConditions.push(`phone_number.eq.${last10Digits}`);
  }
  
  // Add ILIKE patterns for partial matching
  formatConditions.push(`phone_number.ilike.%${last10Digits}%`);
  
  const orQuery = formatConditions.join(',');
  console.log(`Resolving contact and company for phone: ${normalizedPhone} (searching with OR query)`);
  
  // Get all contacts for this phone number using comprehensive format search
  let { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*, companies:company_id(id, name)')
    .or(orQuery);

  if (contactsError) {
    console.error('Error querying contacts with OR query:', contactsError);
    // Fallback to exact match with normalized format
    const { data: fallbackContacts, error: fallbackError } = await supabase
      .from('contacts')
      .select('*, companies:company_id(id, name)')
      .eq('phone_number', normalizedPhone);
    
    if (fallbackError) {
      console.error('Error in fallback query:', fallbackError);
      return null;
    }
    
    if (!fallbackContacts || fallbackContacts.length === 0) {
      console.log(`No contacts found for phone ${normalizedPhone} (after fallback)`);
      return null;
    }
    
    // Use fallback results
    contacts = fallbackContacts;
  }

  if (!contacts || contacts.length === 0) {
    console.log(`No contacts found for phone ${normalizedPhone}`);
    return null;
  }

  console.log(`Found ${contacts.length} contacts for phone ${normalizedPhone}:`, contacts.map(c => ({ id: c.id, role: c.role, company_id: c.company_id, full_name: c.full_name })));

  // Filter contacts: prioritize company contacts over homeowners
  const companyContacts = contacts.filter(c => c.role !== 'HO' && c.company_id);
  const homeownerContacts = contacts.filter(c => c.role === 'HO');

  console.log(`Company contacts: ${companyContacts.length}, Homeowner contacts: ${homeownerContacts.length}`);

  let relevantContacts = companyContacts.length > 0 ? companyContacts : homeownerContacts;

  // If we only have homeowner contacts, we need to look up their projects to find company_id
  if (relevantContacts.length > 0 && relevantContacts[0].role === 'HO') {
    console.log('Processing homeowner contacts - looking up projects');
    return await resolveHomeownerCompany(supabase, normalizedPhone, relevantContacts);
  }

  // Handle company contacts (existing logic)
  if (relevantContacts.length === 0) {
    console.log('No relevant contacts found');
    return null;
  }

  // If there's only one relevant contact, use it
  if (relevantContacts.length === 1) {
    const contact = relevantContacts[0];
    
    // Double check that we have a company_id
    if (!contact.company_id) {
      console.log(`Contact ${contact.id} has no company_id, cannot create session`);
      return null;
    }
    
    console.log(`Using single company contact: ${contact.id} with company ${contact.company_id}`);
    return {
      contact: contact,
      companyId: contact.company_id
    };
  }

  // Multiple company contacts - need to ask user to select
  const uniqueCompanies = Array.from(
    new Map(relevantContacts.map(c => [c.company_id, { 
      id: c.company_id, 
      name: c.companies?.name || 'Unknown Company',
      contact_id: c.id 
    }])).values()
  );

  if (uniqueCompanies.length === 1) {
    // Multiple contacts but same company
    const contact = relevantContacts[0];
    
    // Double check that we have a company_id
    if (!contact.company_id) {
      console.log(`Contact ${contact.id} has no company_id, cannot create session`);
      return null;
    }
    
    console.log(`Using contact from single company: ${contact.id} with company ${contact.company_id}`);
    return {
      contact: contact,
      companyId: contact.company_id
    };
  }

  // Multiple companies - create a selection session
  console.log(`Multiple companies found, creating selection menu`);
  await createCompanySelectionSession(supabase, phoneNumber, uniqueCompanies);
  
  return null; // Will be handled by company selection flow
}

async function resolveHomeownerCompany(supabase: any, phoneNumber: string, homeownerContacts: any[]) {
  console.log(`Resolving company for ${homeownerContacts.length} homeowner contacts`);
  
  // Get all projects associated with these homeowner contacts
  const contactIds = homeownerContacts.map(c => c.id);
  console.log(`Looking up projects for contact IDs: ${contactIds.join(', ')}`);
  
  const { data: projectData, error: projectError } = await supabase
    .from('project_contacts')
    .select(`
      project_id,
      contact_id,
      projects:project_id (
        id,
        company_id,
        project_name,
        companies:company_id (
          id,
          name
        )
      )
    `)
    .in('contact_id', contactIds);

  console.log(`Project query result:`, { projectData, projectError });

  if (projectError) {
    console.error('Error querying projects for homeowner:', projectError);
    await sendSMS(supabase, phoneNumber, "Sorry, there was an error looking up your project information. Please try again later.");
    return null;
  }

  if (!projectData || projectData.length === 0) {
    console.log('No projects found for homeowner contacts');
    await sendSMS(supabase, phoneNumber, "I couldn't find any projects associated with your account. Please contact your project manager to get set up.");
    return null;
  }

  console.log(`Found ${projectData.length} project associations for homeowner`);

  // Filter out any projects without valid company data
  const validProjects = projectData.filter(pd => pd.projects && pd.projects.company_id && pd.projects.companies);
  
  if (validProjects.length === 0) {
    console.log('No projects with valid company data found');
    await sendSMS(supabase, phoneNumber, "I found your projects but they don't have valid company information. Please contact your project manager.");
    return null;
  }

  console.log(`Found ${validProjects.length} valid project associations`);

  // Get unique project-company combinations
  const uniqueProjectCompanies = Array.from(
    new Map(validProjects.map(pd => [
      `${pd.projects.id}-${pd.projects.company_id}`,
      {
        projectId: pd.projects.id,
        projectName: pd.projects.project_name || `Project ${pd.projects.id.slice(0, 8)}`,
        companyId: pd.projects.company_id,
        companyName: pd.projects.companies?.name || 'Unknown Company',
        contactId: pd.contact_id
      }
    ])).values()
  );

  console.log(`Unique project-company combinations: ${uniqueProjectCompanies.length}`);

  if (uniqueProjectCompanies.length === 1) {
    // Only one project/company combination
    const projectCompany = uniqueProjectCompanies[0];
    const contact = homeownerContacts.find(c => c.id === projectCompany.contactId);
    
    console.log(`Using single project ${projectCompany.projectName} for company ${projectCompany.companyName}`);
    
    return {
      contact: contact,
      companyId: projectCompany.companyId,
      projectId: projectCompany.projectId
    };
  }

  // Multiple projects - need user to select
  console.log(`Multiple projects found, creating selection menu`);
  await createProjectSelectionSession(supabase, phoneNumber, uniqueProjectCompanies, homeownerContacts[0]);
  
  return null; // Will be handled by project selection flow
}

async function createProjectSelectionSession(supabase: any, phoneNumber: string, projectCompanies: any[], contact: any) {
  // Create a special session for project selection
  const { data: sessionId } = await supabase.rpc('find_or_create_chat_session', {
    p_channel_type: 'sms',
    p_channel_identifier: phoneNumber,
    p_company_id: projectCompanies[0].companyId, // Use first company as placeholder
    p_contact_id: contact.id,
    p_project_id: null,
    p_memory_mode: 'project_selection'
  });

  // Store the project options in the session history for reference
  await supabase
    .from('chat_sessions')
    .update({
      conversation_history: [{
        role: 'system',
        content: 'Project selection in progress',
        projectCompanies: projectCompanies
      }]
    })
    .eq('id', sessionId);

  // Send project selection menu
  let selectionMessage = "I see you have multiple projects. Please select which project you're asking about:\n\n";
  projectCompanies.forEach((pc, index) => {
    selectionMessage += `${index + 1}. ${pc.projectName} (${pc.companyName})\n`;
  });
  selectionMessage += "\nReply with the number of your choice.";

  await sendSMS(supabase, phoneNumber, selectionMessage);
}

async function createCompanySelectionSession(supabase: any, phoneNumber: string, companies: any[]) {
  // Create a special session for company selection
  const { data: sessionId } = await supabase.rpc('find_or_create_chat_session', {
    p_channel_type: 'sms',
    p_channel_identifier: phoneNumber,
    p_company_id: companies[0].id, // Use first company as placeholder
    p_contact_id: companies[0].contact_id,
    p_project_id: null,
    p_memory_mode: 'company_selection'
  });

  // Store the companies in the session history for reference
  await supabase
    .from('chat_sessions')
    .update({
      conversation_history: [{
        role: 'system',
        content: 'Company selection in progress',
        companies: companies
      }]
    })
    .eq('id', sessionId);

  // Send company selection menu
  let selectionMessage = "I see you're associated with multiple companies. Please select which company you're contacting about:\n\n";
  companies.forEach((company, index) => {
    selectionMessage += `${index + 1}. ${company.name}\n`;
  });
  selectionMessage += "\nReply with the number of your choice.";

  await sendSMS(supabase, phoneNumber, selectionMessage);
}

async function getOrCreateChatSession(supabase: any, from: string, body: string, contact: any, companyId: string | null, projectId?: string) {
  try {
    console.log(`Creating chat session for contact ${contact.id} from ${from} with company ${companyId || 'none'}${projectId ? ` and project ${projectId}` : ''}`);
    
    // Use the database function directly instead of calling the edge function
    const { data: sessionId, error } = await supabase.rpc('find_or_create_chat_session', {
      p_channel_type: 'sms',
      p_channel_identifier: from,
      p_company_id: companyId, // Can be null for contacts without company
      p_contact_id: contact.id,
      p_project_id: projectId || null, // Will be determined later by the AI agent
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
    
    // ADD DIAGNOSTIC LOGGING
    const agentChatPayload = {
      messages: messages,
      availableTools: ['session_manager', 'identify_project', 'data_fetch', 'channel_response'],
      customPrompt: `You are responding to an SMS message. Be concise and provide clear information.
Current session: ${sessionId}
Keep responses conversational and friendly, using first names when appropriate.`,
      contact_id: userToken.contact_id // Changed from userId to contact_id
    };
    
    console.log('=== DIAGNOSTIC: Agent-chat payload being sent ===');
    console.log('Contact ID being passed:', userToken.contact_id);
    console.log('Full payload:', JSON.stringify(agentChatPayload, null, 2));
    console.log('=== END DIAGNOSTIC ===');
    
    const agentResponse = await userSupabase.functions.invoke('agent-chat', {
      body: agentChatPayload
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
    
    if (channelResponse.data) {
      console.log(`Message sent successfully via ${channelResponse.data.channel_type}`, channelResponse.data);
      return;
    }
    
    console.warn('send-channel-message returned no data', channelResponse.error);
  } catch (error) {
    console.error('Error in sendDirectChannelResponse:', error);
  }

  // Fallback: if channel-message failed, try to send SMS directly for SMS sessions
  try {
    const { data: session, error: sessionError } = await userSupabase
      .from('chat_sessions')
      .select('channel_type, channel_identifier')
      .eq('id', sessionId)
      .maybeSingle();
    
    if (sessionError) {
      console.error('Fallback: error fetching session for direct SMS:', sessionError);
      return;
    }

    if (session && session.channel_type === 'sms' && session.channel_identifier) {
      console.log('Fallback: sending SMS directly via Twilio for session', sessionId);
      await sendSMS(userSupabase, session.channel_identifier, assistantMessage);
    }
  } catch (fallbackError) {
    console.error('Fallback: error in direct SMS send:', fallbackError);
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
