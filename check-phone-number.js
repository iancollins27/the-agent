// Check if a phone number is in the system
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const userProfile = process.env.USERPROFILE || process.env.HOME;
const mcpConfigPath = path.join(userProfile, '.cursor', 'mcp.json');
const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

const supabase = createClient(
  config.mcpServers.supabase.env.SUPABASE_URL,
  config.mcpServers.supabase.env.SUPABASE_SERVICE_ROLE_KEY
);

const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.log('Usage: node check-phone-number.js +1234567890');
  console.log('Example: node check-phone-number.js +15551234567');
  process.exit(1);
}

// Normalize phone number (ensure + prefix)
const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

async function checkPhone() {
  console.log(`🔍 Checking phone number: ${normalizedPhone}\n`);

  // Check contacts
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('phone_number', normalizedPhone);

  if (contactsError) {
    console.error('Error checking contacts:', contactsError.message);
  } else if (contacts && contacts.length > 0) {
    console.log(`✅ Found ${contacts.length} contact(s):`);
    contacts.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.full_name || 'Unnamed'} (${c.role || 'No role'})`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Company: ${c.company_id || 'None'}`);
    });
  } else {
    console.log('❌ Phone number NOT found in contacts table');
    console.log('   This means you\'ll need to verify via OTP first');
  }

  // Check phone verifications
  console.log('\n📱 Phone Verification Status:');
  const { data: verification, error: verifError } = await supabase
    .from('phone_verifications')
    .select('*')
    .eq('phone_number', normalizedPhone)
    .single();

  if (verifError && verifError.code !== 'PGRST116') {
    console.error('Error checking verification:', verifError.message);
  } else if (verification) {
    if (verification.verified_at) {
      console.log(`✅ Phone number is VERIFIED`);
      console.log(`   Verified at: ${new Date(verification.verified_at).toLocaleString()}`);
    } else {
      console.log(`❌ Phone number is NOT verified`);
      console.log(`   You need to complete OTP verification first`);
    }
    if (verification.locked_until && new Date(verification.locked_until) > new Date()) {
      console.log(`🔒 Phone is LOCKED until ${new Date(verification.locked_until).toLocaleString()}`);
    }
  } else {
    console.log('❌ No verification record found');
    console.log('   This is a new number - will need OTP verification');
  }

  // Check chat sessions
  console.log('\n💬 Chat Sessions:');
  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('channel_identifier', normalizedPhone)
    .order('last_activity', { ascending: false });

  if (sessionsError) {
    console.error('Error checking sessions:', sessionsError.message);
  } else if (sessions && sessions.length > 0) {
    console.log(`✅ Found ${sessions.length} chat session(s):`);
    sessions.forEach((s, i) => {
      const lastActivity = s.last_activity ? new Date(s.last_activity).toLocaleString() : 'Never';
      console.log(`   ${i + 1}. Last activity: ${lastActivity}`);
      console.log(`      Messages: ${s.conversation_history?.length || 0}`);
    });
  } else {
    console.log('❌ No chat sessions found for this number');
  }

  console.log('\n📋 Summary:');
  const hasContact = contacts && contacts.length > 0;
  const isVerified = verification?.verified_at;
  const hasSession = sessions && sessions.length > 0;

  if (hasContact && isVerified) {
    console.log('✅ Phone number is set up and ready to use');
  } else if (!hasContact) {
    console.log('⚠️  Phone number not in contacts - will be created during OTP verification');
  } else if (!isVerified) {
    console.log('⚠️  Phone number needs OTP verification');
    console.log('   Text the Twilio number and reply with the OTP code');
  }
}

checkPhone().catch(console.error);

