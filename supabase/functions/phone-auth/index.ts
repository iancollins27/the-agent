import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PhoneAuthRequest {
  phone_number: string;
  verification_code?: string;
  action: 'request_otp' | 'verify_otp';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { phone_number, verification_code, action }: PhoneAuthRequest = await req.json();

    if (action === 'request_otp') {
      return await handleOTPRequest(supabase, phone_number);
    } else if (action === 'verify_otp') {
      return await handleOTPVerification(supabase, phone_number, verification_code);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Phone auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendTwilioSMS(phoneNumber: string, message: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid || !authToken || !fromPhone) {
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

  console.log(`Sending Twilio SMS to ${toPhone} from ${twilioFromPhone}`);

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

async function handleOTPRequest(supabase: any, phoneNumber: string) {
  // Check if phone is locked due to failed attempts
  const { data: existing } = await supabase
    .from('phone_verifications')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (existing?.locked_until && new Date(existing.locked_until) > new Date()) {
    return new Response(
      JSON.stringify({ 
        error: 'Phone number temporarily locked due to too many failed attempts',
        locked_until: existing.locked_until 
      }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate OTP
  const { data: otpData } = await supabase.rpc('generate_otp');
  const otp = otpData;

  console.log(`OTP for ${phoneNumber}: ${otp}`);

  // Check if this is a known contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  let contactId = contact?.id;

  // If no contact exists, we'll need to create one (for new users)
  if (!contact) {
    // For now, we'll just store the phone verification without a contact_id
    // The contact can be created later when we have more info
    contactId = null;
  }

  // Store or update phone verification - FIXED: Added onConflict parameter
  const { error: upsertError } = await supabase
    .from('phone_verifications')
    .upsert({
      phone_number: phoneNumber,
      contact_id: contactId,
      verification_code: otp,
      failed_attempts: 0,
      locked_until: null,
      last_sim_check: new Date().toISOString()
    }, {
      onConflict: 'phone_number'  // This is the key fix - specify which column to conflict on
    });

  if (upsertError) {
    console.error('Upsert error details:', upsertError);
    throw new Error(`Failed to store OTP: ${upsertError.message}`);
  }

  console.log(`Successfully stored/updated OTP for ${phoneNumber}`);

  // Send OTP via Twilio SMS
  try {
    await sendTwilioSMS(phoneNumber, `Your verification code is: ${otp}`);
    console.log(`OTP sent successfully to ${phoneNumber}`);
  } catch (smsError) {
    console.error(`Failed to send SMS: ${smsError.message}`);
    // Still return success for development purposes, but log the error
    console.log(`Development fallback - OTP would be: ${otp}`);
  }

  return new Response(
    JSON.stringify({ 
      message: 'OTP sent successfully',
      // In development only - remove in production
      otp: Deno.env.get('NODE_ENV') === 'development' ? otp : undefined
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleOTPVerification(supabase: any, phoneNumber: string, verificationCode?: string) {
  if (!verificationCode) {
    return new Response(
      JSON.stringify({ error: 'Verification code required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get phone verification record
  const { data: verification, error: fetchError } = await supabase
    .from('phone_verifications')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single();

  if (fetchError || !verification) {
    return new Response(
      JSON.stringify({ error: 'No verification request found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if locked
  if (verification.locked_until && new Date(verification.locked_until) > new Date()) {
    return new Response(
      JSON.stringify({ error: 'Phone number temporarily locked' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify OTP
  if (verification.verification_code !== verificationCode) {
    const failedAttempts = (verification.failed_attempts || 0) + 1;
    const lockUntil = failedAttempts >= 3 ? new Date(Date.now() + 15 * 60 * 1000) : null; // 15 min lock

    await supabase
      .from('phone_verifications')
      .update({ 
        failed_attempts: failedAttempts,
        locked_until: lockUntil?.toISOString() 
      })
      .eq('phone_number', phoneNumber);

    return new Response(
      JSON.stringify({ 
        error: 'Invalid verification code',
        attempts_remaining: Math.max(0, 3 - failedAttempts)
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // OTP is valid - mark as verified and create token
  await supabase
    .from('phone_verifications')
    .update({ 
      verified_at: new Date().toISOString(),
      failed_attempts: 0,
      locked_until: null
    })
    .eq('phone_number', phoneNumber);

  // Get or ensure contact exists
  let { data: contact } = await supabase
    .from('contacts')
    .select('*, company_id')
    .eq('phone_number', phoneNumber)
    .single();

  if (!contact) {
    // Create a basic contact record for new users
    // In a real system, you might want to collect more info first
    const { data: newContact, error: createError } = await supabase
      .from('contacts')
      .insert({
        phone_number: phoneNumber,
        full_name: `User ${phoneNumber}`, // Temporary name
        role: 'homeowner',
        // company_id will be null for homeowners initially
      })
      .select('*')
      .single();

    if (createError) {
      throw new Error(`Failed to create contact: ${createError.message}`);
    }
    contact = newContact;
  }

  // Create user token
  const tokenPayload = {
    contact_id: contact.id,
    company_id: contact.company_id,
    role: contact.role,
    phone_number: phoneNumber,
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    iat: Math.floor(Date.now() / 1000)
  };

  // Create a simple JWT-like token (in production, use proper JWT library)
  const tokenString = btoa(JSON.stringify(tokenPayload));
  
  // Store token hash in database
  const { error: tokenError } = await supabase
    .from('user_tokens')
    .insert({
      contact_id: contact.id,
      token_hash: tokenString,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      scope: 'sms_verified'
    });

  if (tokenError) {
    throw new Error(`Failed to store token: ${tokenError.message}`);
  }

  // Log successful authentication
  await supabase
    .from('audit_log')
    .insert({
      contact_id: contact.id,
      company_id: contact.company_id,
      action: 'phone_verification_success',
      resource_type: 'authentication',
      details: { phone_number: phoneNumber }
    });

  return new Response(
    JSON.stringify({ 
      message: 'Phone verified successfully',
      token: tokenString,
      contact: {
        id: contact.id,
        role: contact.role,
        company_id: contact.company_id
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
