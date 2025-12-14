# Quick Fix: Agent Chat Not Responding

## The Problem
You texted the agent chat phone number but got no response.

## Most Likely Cause (90% of cases)
**Twilio webhook URL is not configured or is incorrect**

## 30-Second Fix

1. **Go to**: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. **Click** on your Twilio phone number
3. **Scroll to** "Messaging" section
4. **Set "A MESSAGE COMES IN"** to:
   ```
   https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/chat-webhook-twilio
   ```
5. **Set HTTP method**: POST
6. **Click Save**
7. **Text the number again**

## If That Doesn't Work

### Check 1: Is your phone number verified?
- Text the number
- You should get an OTP code
- Reply with the code
- Then text again

### Check 2: Are Twilio credentials set?
- Supabase Dashboard → Settings → Edge Functions
- Verify these are set:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`  
  - `TWILIO_PHONE_NUMBER`

### Check 3: Check function logs
- Supabase Dashboard → Edge Functions → chat-webhook-twilio → Logs
- Look for errors when you sent the text

## Test It

After fixing, text: **"Hello"** or **"Test"**

You should receive:
- ✅ OTP code (if first time)
- ✅ Agent response (if already verified)
- ❌ Nothing (webhook still not configured)

## Still Not Working?

Tell me:
1. Your phone number (I can check if it's in the system)
2. When you sent the text
3. What you see in Supabase function logs

