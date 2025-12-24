
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Add support for providers like SendGrid, Mailgun, etc.
// This example is based on SendGrid
interface SendGridEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    type: string;
  }>;
  // Add other SendGrid-specific fields as needed
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }
  
  // Public webhook - we'll verify the payload in other ways
  
  try {
    console.log("Email webhook triggered");
    
    // Extract the payload - in a real implementation, verify webhook signatures
    const payload = await req.json();
    console.log("Received email webhook payload:", JSON.stringify(payload).substring(0, 500) + "...");
    
    // Parse the email data based on provider
    // This example assumes SendGrid format - adapt as needed
    const emailData = parseEmailData(payload);
    
    if (!emailData) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid email payload",
          message: "Could not parse email data from webhook"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Store the raw webhook data
    const { data: rawData, error: rawError } = await supabase
      .from('raw_comms_webhooks')
      .insert({
        service_name: 'email',
        raw_payload: payload,
        webhook_id: payload.id || payload.messageId || null,
        signature: payload.signature || null
      })
      .select()
      .single();
      
    if (rawError) {
      console.error('Error storing raw webhook:', rawError);
      // Continue despite error
    }
    
    // Find the company associated with the recipient email
    // In a real implementation, you would have a way to route emails to the correct company
    const toEmail = emailData.to[0].toLowerCase();
    
    // Find company by email pattern (e.g., company-specific domains)
    // This is a placeholder - implement your own routing logic
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (companyError || !companies || companies.length === 0) {
      console.error('Error finding company for email:', companyError);
      return new Response(
        JSON.stringify({ 
          error: "Company not found",
          message: "Could not determine which company this email belongs to"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const companyId = companies[0].id;
    
    // Create a communication record
    const { data: commRecord, error: commError } = await supabase
      .from('communications')
      .insert({
        type: 'EMAIL',
        subtype: 'email_message',
        direction: 'INBOUND',
        content: emailData.text || emailData.html || '',
        timestamp: new Date().toISOString(),
        participants: [
          {
            type: 'sender',
            email: emailData.from,
            name: emailData.fromName || emailData.from.split('@')[0]
          },
          {
            type: 'recipient',
            email: toEmail,
            name: toEmail.split('@')[0]
          }
        ],
        provider: 'email',
        status: 'RECEIVED',
        company_id: companyId
      })
      .select()
      .single();

    if (commError) {
      console.error('Error creating communication record:', commError);
      return new Response(
        JSON.stringify({ 
          error: commError.message,
          message: "Failed to create communication record"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create or update the chat session for this email
    const sessionResponse = await fetch(`${supabaseUrl}/functions/v1/tool-session-manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        channel_type: 'email',
        channel_identifier: emailData.from,
        company_id: companyId,
        memory_mode: 'detailed',
        communication_id: commRecord.id
      })
    });
    
    if (!sessionResponse.ok) {
      console.error('Error creating chat session:', await sessionResponse.text());
      // Continue despite error
    }

    // Trigger the business logic processor to handle this communication
    const businessLogicResponse = await fetch(`${supabaseUrl}/functions/v1/comms-business-logic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        communicationId: commRecord.id
      })
    });
    
    if (!businessLogicResponse.ok) {
      console.error('Error triggering business logic:', await businessLogicResponse.text());
      // Continue despite error - we've received the email successfully
    }
    
    // Return success
    return new Response(
      JSON.stringify({ 
        message: "Email processed successfully",
        communication_id: commRecord.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in email-webhook function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function to parse email data from different providers
function parseEmailData(payload: any): { from: string; fromName?: string; to: string[]; subject: string; text?: string; html?: string } | null {
  try {
    // SendGrid format
    if (payload.email) {
      return {
        from: payload.email,
        fromName: payload.name || undefined,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject || '',
        text: payload.text || '',
        html: payload.html || undefined
      };
    }
    
    // Mailgun format
    if (payload['sender'] && payload['recipient']) {
      return {
        from: payload.sender,
        to: Array.isArray(payload.recipient) ? payload.recipient : [payload.recipient],
        subject: payload.subject || '',
        text: payload['body-plain'] || '',
        html: payload['body-html'] || undefined
      };
    }
    
    // Generic format
    if (payload.from && payload.to) {
      return {
        from: typeof payload.from === 'string' ? payload.from : payload.from.email || payload.from.address,
        fromName: typeof payload.from === 'object' ? payload.from.name : undefined,
        to: Array.isArray(payload.to) ? 
            payload.to.map((t: any) => typeof t === 'string' ? t : t.email || t.address) : 
            [typeof payload.to === 'string' ? payload.to : payload.to.email || payload.to.address],
        subject: payload.subject || '',
        text: payload.text || payload.body || '',
        html: payload.html || undefined
      };
    }
    
    return null;
  } catch (e) {
    console.error('Error parsing email data:', e);
    return null;
  }
}
