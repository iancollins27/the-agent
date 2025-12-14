// Investigate SMS/Agent Chat Issues
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

async function investigateSMS() {
  console.log('🔍 Investigating SMS/Agent Chat Issues...\n');

  // 1. Check recent SMS communications
  console.log('1️⃣ Recent SMS Communications (Last 20):');
  const { data: comms, error: commsError } = await supabase
    .from('communications')
    .select('*')
    .or('type.ilike.%SMS%,subtype.ilike.%sms%')
    .order('timestamp', { ascending: false })
    .limit(20);

  if (commsError) {
    console.error('   Error:', commsError.message);
  } else {
    comms?.forEach((comm, i) => {
      const time = new Date(comm.timestamp).toLocaleString();
      const direction = comm.direction === 'INBOUND' ? '📥' : '📤';
      console.log(`   ${i + 1}. [${time}] ${direction} ${comm.type} - Status: ${comm.status}`);
      if (comm.participants && comm.participants.length > 0) {
        const phone = comm.participants[0]?.phone || comm.participants[0]?.phone_number;
        if (phone) console.log(`      Phone: ${phone}`);
      }
      if (comm.content) {
        const preview = comm.content.substring(0, 50);
        console.log(`      Message: ${preview}${comm.content.length > 50 ? '...' : ''}`);
      }
    });
  }

  // 2. Check recent audit logs for SMS activity
  console.log('\n2️⃣ Recent SMS Audit Logs (Last 20):');
  const { data: auditLogs, error: auditError } = await supabase
    .from('audit_log')
    .select('*')
    .or('action.ilike.%sms%,action.ilike.%SMS%')
    .order('created_at', { ascending: false })
    .limit(20);

  if (auditError) {
    console.error('   Error:', auditError.message);
  } else {
    auditLogs?.forEach((log, i) => {
      const time = new Date(log.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] ${log.action}`);
      if (log.details) {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (details.phone_number) console.log(`      Phone: ${details.phone_number}`);
        if (details.error) console.log(`      ❌ Error: ${details.error}`);
        if (details.message_length) console.log(`      Length: ${details.message_length} chars`);
      }
    });
  }

  // 3. Check chat sessions
  console.log('\n3️⃣ Recent Chat Sessions (Last 10):');
  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (sessionsError) {
    console.error('   Error:', sessionsError.message);
  } else {
    sessions?.forEach((session, i) => {
      const time = new Date(session.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] Channel: ${session.channel_type} | ID: ${session.channel_identifier}`);
      console.log(`      Session ID: ${session.id.substring(0, 8)}...`);
      console.log(`      Contact: ${session.contact_id ? session.contact_id.substring(0, 8) + '...' : 'None'}`);
      console.log(`      Company: ${session.company_id ? session.company_id.substring(0, 8) + '...' : 'None'}`);
      console.log(`      Last Activity: ${session.last_activity ? new Date(session.last_activity).toLocaleString() : 'Never'}`);
      if (session.conversation_history && session.conversation_history.length > 0) {
        console.log(`      Messages: ${session.conversation_history.length}`);
      }
    });
  }

  // 4. Check phone verifications
  console.log('\n4️⃣ Recent Phone Verifications (Last 10):');
  const { data: verifications, error: verifError } = await supabase
    .from('phone_verifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (verifError) {
    console.error('   Error:', verifError.message);
  } else {
    verifications?.forEach((v, i) => {
      const time = new Date(v.created_at).toLocaleString();
      const verified = v.verified_at ? '✅ Verified' : '❌ Not Verified';
      console.log(`   ${i + 1}. [${time}] ${v.phone_number} - ${verified}`);
      if (v.verified_at) {
        console.log(`      Verified at: ${new Date(v.verified_at).toLocaleString()}`);
      }
      if (v.failed_attempts > 0) {
        console.log(`      Failed attempts: ${v.failed_attempts}`);
      }
      if (v.locked_until) {
        console.log(`      🔒 Locked until: ${new Date(v.locked_until).toLocaleString()}`);
      }
    });
  }

  // 5. Check for errors related to SMS/webhook
  console.log('\n5️⃣ Recent SMS/Webhook Errors (Last 10):');
  const { data: errors, error: errorQueryError } = await supabase
    .from('audit_log')
    .select('*')
    .or('action.ilike.%sms%error%,action.ilike.%webhook%error%,action.ilike.%sms%fail%,details.cs.%error%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (errorQueryError) {
    console.error('   Error querying:', errorQueryError.message);
  } else if (errors && errors.length > 0) {
    errors.forEach((err, i) => {
      const time = new Date(err.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] ${err.action}`);
      if (err.details) {
        const details = typeof err.details === 'string' ? JSON.parse(err.details) : err.details;
        console.log(`      Details:`, JSON.stringify(details, null, 2));
      }
    });
  } else {
    console.log('   ✅ No SMS/webhook errors found in audit logs');
  }

  // 6. Check Twilio configuration
  console.log('\n6️⃣ Configuration Check:');
  console.log('   Checking for Twilio webhook endpoint...');
  console.log('   Expected webhook: chat-webhook-twilio function');
  console.log('   Check Supabase Dashboard → Edge Functions → chat-webhook-twilio');
  console.log('   Verify webhook URL is set in Twilio:');
  console.log('   https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/chat-webhook-twilio');
}

investigateSMS().catch(console.error);

