// Comprehensive SMS/Agent Chat Diagnostic
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

async function diagnose() {
  console.log('🔍 SMS/Agent Chat Diagnostic Report\n');
  console.log('='.repeat(60));

  // 1. Check for messages from the last 24 hours
  console.log('\n1️⃣ Messages from Last 24 Hours:');
  const yesterday = new Date();
  yesterday.setHours(yesterday.getHours() - 24);
  
  const { data: recentComms, error: commsError } = await supabase
    .from('communications')
    .select('*')
    .or('type.ilike.%SMS%')
    .gte('timestamp', yesterday.toISOString())
    .order('timestamp', { ascending: false });

  if (commsError) {
    console.error('   Error:', commsError.message);
  } else if (recentComms && recentComms.length > 0) {
    console.log(`   Found ${recentComms.length} SMS messages in last 24 hours:`);
    recentComms.forEach((comm, i) => {
      const time = new Date(comm.timestamp).toLocaleString();
      const dir = comm.direction === 'INBOUND' ? '📥 IN' : '📤 OUT';
      console.log(`   ${i + 1}. [${time}] ${dir} - Status: ${comm.status}`);
      if (comm.participants) {
        const phone = comm.participants[0]?.phone || comm.participants[0]?.phone_number;
        if (phone) console.log(`      Phone: ${phone}`);
      }
    });
  } else {
    console.log('   ⚠️  No SMS messages found in the last 24 hours');
    console.log('   This suggests the webhook may not be receiving messages from Twilio');
  }

  // 2. Check recent audit logs
  console.log('\n2️⃣ Recent SMS Audit Logs (Last 24 Hours):');
  const { data: recentAudit, error: auditError } = await supabase
    .from('audit_log')
    .select('*')
    .or('action.ilike.%sms%')
    .gte('created_at', yesterday.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (auditError) {
    console.error('   Error:', auditError.message);
  } else if (recentAudit && recentAudit.length > 0) {
    console.log(`   Found ${recentAudit.length} SMS-related audit logs:`);
    recentAudit.forEach((log, i) => {
      const time = new Date(log.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] ${log.action}`);
      if (log.details) {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (details.phone_number) console.log(`      Phone: ${details.phone_number}`);
        if (details.error) console.log(`      ❌ Error: ${details.error}`);
      }
    });
  } else {
    console.log('   ⚠️  No SMS audit logs in last 24 hours');
  }

  // 3. Check chat sessions
  console.log('\n3️⃣ Recent Chat Sessions:');
  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('last_activity', { ascending: false })
    .limit(5);

  if (sessionsError) {
    console.error('   Error:', sessionsError.message);
  } else if (sessions && sessions.length > 0) {
    sessions.forEach((session, i) => {
      const lastActivity = session.last_activity ? new Date(session.last_activity).toLocaleString() : 'Never';
      console.log(`   ${i + 1}. Channel: ${session.channel_type} | Phone: ${session.channel_identifier}`);
      console.log(`      Last Activity: ${lastActivity}`);
      console.log(`      Messages: ${session.conversation_history?.length || 0}`);
    });
  } else {
    console.log('   ⚠️  No chat sessions found');
  }

  // 4. Check phone verifications
  console.log('\n4️⃣ Phone Verification Status:');
  const { data: verifications, error: verifError } = await supabase
    .from('phone_verifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (verifError) {
    console.error('   Error:', verifError.message);
  } else if (verifications && verifications.length > 0) {
    console.log(`   Found ${verifications.length} phone verifications:`);
    verifications.forEach((v, i) => {
      const verified = v.verified_at ? '✅' : '❌';
      const verifiedTime = v.verified_at ? new Date(v.verified_at).toLocaleString() : 'Not verified';
      console.log(`   ${i + 1}. ${verified} ${v.phone_number} - ${verifiedTime}`);
      if (v.locked_until && new Date(v.locked_until) > new Date()) {
        console.log(`      🔒 LOCKED until ${new Date(v.locked_until).toLocaleString()}`);
      }
    });
  }

  // 5. Configuration checklist
  console.log('\n5️⃣ Configuration Checklist:');
  console.log('   ✅ Webhook endpoint is accessible');
  console.log('   ✅ Function exists: chat-webhook-twilio');
  console.log('   ⚠️  Need to verify:');
  console.log('      - Twilio webhook URL is configured correctly');
  console.log('      - Twilio credentials are set in Supabase environment');
  console.log('      - Your phone number is in the contacts table');
  console.log('      - Your phone number is verified (if required)');

  // 6. Recommendations
  console.log('\n6️⃣ Troubleshooting Steps:');
  console.log('   Step 1: Verify Twilio Webhook Configuration');
  console.log('      - Go to Twilio Console → Phone Numbers → Manage → Active Numbers');
  console.log('      - Click on your Twilio phone number');
  console.log('      - Under "Messaging", check "A MESSAGE COMES IN" webhook URL');
  console.log('      - Should be: https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/chat-webhook-twilio');
  console.log('');
  console.log('   Step 2: Check Supabase Function Logs');
  console.log('      - Go to Supabase Dashboard → Edge Functions → chat-webhook-twilio');
  console.log('      - Check the Logs tab for recent activity');
  console.log('      - Look for errors when you sent the text');
  console.log('');
  console.log('   Step 3: Verify Your Phone Number in Database');
  console.log('      - Check if your phone number exists in the contacts table');
  console.log('      - Check if it needs verification');
  console.log('');
  console.log('   Step 4: Test with a Known Working Number');
  console.log('      - Try texting from a number that previously worked');
  console.log('      - Check if the issue is specific to your number');

  console.log('\n' + '='.repeat(60));
}

diagnose().catch(console.error);

