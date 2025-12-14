// Test if the webhook endpoint is accessible
const webhookUrl = 'https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/chat-webhook-twilio';

async function testWebhook() {
  console.log('🧪 Testing Chat Webhook Endpoint...\n');
  console.log('URL:', webhookUrl);
  
  try {
    // Test 1: OPTIONS request (CORS preflight)
    console.log('\n1️⃣ Testing CORS preflight (OPTIONS)...');
    const optionsResponse = await fetch(webhookUrl, {
      method: 'OPTIONS'
    });
    console.log(`   Status: ${optionsResponse.status}`);
    console.log(`   CORS Headers:`, {
      'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods')
    });

    // Test 2: POST with minimal Twilio-like payload
    console.log('\n2️⃣ Testing POST with sample Twilio payload...');
    const testPayload = new URLSearchParams({
      From: '+15551234567',
      Body: 'Test message',
      MessageSid: 'SM' + Date.now()
    });

    const postResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: testPayload
    });

    const responseText = await postResponse.text();
    console.log(`   Status: ${postResponse.status}`);
    console.log(`   Response: ${responseText.substring(0, 200)}`);

    if (postResponse.ok) {
      console.log('   ✅ Webhook endpoint is accessible');
    } else {
      console.log('   ⚠️  Webhook returned error status');
    }

  } catch (error) {
    console.error('   ❌ Error testing webhook:', error.message);
    console.error('   This could mean:');
    console.error('   - The function is not deployed');
    console.error('   - The URL is incorrect');
    console.error('   - Network/firewall issue');
  }
}

testWebhook();

