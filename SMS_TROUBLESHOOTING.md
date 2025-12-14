# SMS/Agent Chat Troubleshooting Guide

## Issue: Agent Chat Not Responding to Texts

### Quick Diagnosis Results

✅ **Webhook Endpoint**: Accessible and working  
❌ **Recent Messages**: None received in last 24 hours  
⚠️ **Most Likely Issue**: Twilio webhook URL not configured

---

## Step-by-Step Fix

### Step 1: Verify Twilio Webhook Configuration ⚠️ **MOST IMPORTANT**

1. **Go to Twilio Console**:
   - Visit: https://console.twilio.com/
   - Navigate to: **Phone Numbers** → **Manage** → **Active Numbers**

2. **Select Your Twilio Phone Number**:
   - Click on the phone number you're texting

3. **Check Webhook Configuration**:
   - Scroll to the **Messaging** section
   - Find **"A MESSAGE COMES IN"** field
   - **It should be set to**:
     ```
     https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/chat-webhook-twilio
     ```

4. **If it's wrong or empty**:
   - Paste the URL above
   - Set HTTP method to: **POST**
   - Click **Save**

### Step 2: Check Supabase Function Logs

1. **Go to Supabase Dashboard**:
   - Visit: https://supabase.com/dashboard/project/lvifsxsrbluehopamqpy
   - Navigate to: **Edge Functions** → **chat-webhook-twilio**

2. **Check Logs Tab**:
   - Look for entries from when you sent the text
   - Check for any error messages
   - Look for: "Received Twilio chat webhook" messages

3. **What to look for**:
   - ✅ If you see "Received Twilio chat webhook" → Webhook is working, check authentication
   - ❌ If you see nothing → Twilio isn't calling the webhook (Step 1 issue)
   - ❌ If you see errors → Check the error message

### Step 3: Verify Your Phone Number in Database

Run this to check if your phone number is in the system:

```bash
node check-phone-number.js YOUR_PHONE_NUMBER
```

Or I can check it for you - just tell me your phone number (or the last 4 digits if you prefer).

### Step 4: Check Twilio Environment Variables

The function needs these environment variables set in Supabase:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

**To check/update**:
1. Supabase Dashboard → Project Settings → Edge Functions
2. Check if these are set
3. If missing, add them from your Twilio console

### Step 5: Test the Webhook Manually

I've already tested the webhook endpoint and it's responding. But you can also test it:

```bash
node test-webhook-endpoint.js
```

---

## Common Issues & Solutions

### Issue: "No messages received"

**Cause**: Twilio webhook URL not configured  
**Fix**: Follow Step 1 above

### Issue: "Phone number not verified"

**Cause**: Your phone number needs OTP verification  
**Fix**: 
- Text the Twilio number
- You should receive an OTP code
- Reply with the 6-digit code
- Then try again

### Issue: "Phone number not in contacts"

**Cause**: Your phone number isn't in the `contacts` table  
**Fix**: Add your phone number to the contacts table, or the system will create one during OTP verification

### Issue: "Function errors in logs"

**Cause**: Missing environment variables or code error  
**Fix**: Check Supabase function logs for specific error, then fix accordingly

---

## Quick Test

After fixing the webhook URL:

1. **Text your Twilio number** with any message
2. **Wait 5-10 seconds**
3. **Check Supabase logs** to see if it was received
4. **You should receive**:
   - Either an OTP code (if first time)
   - Or an agent response (if already verified)

---

## Need Help?

Tell me:
1. **What phone number did you text from?** (I can check if it's in the system)
2. **What time did you send the text?** (I can check logs for that time)
3. **Did you receive any response at all?** (Even an error message?)

Then I can help diagnose further!

