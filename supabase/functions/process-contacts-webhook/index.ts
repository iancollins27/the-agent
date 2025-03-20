
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContactPayload {
  name: string;
  number: string;
  email: string;
  role: string;
}

interface WebhookPayload {
  contacts: ContactPayload[];
  Bid_ID: number;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the raw request body for debugging
    const requestBody = await req.json();
    console.log('Received contacts webhook payload:', requestBody);

    // Validate the payload
    const payload = requestBody as WebhookPayload;
    
    if (!payload.contacts || !Array.isArray(payload.contacts) || !payload.Bid_ID) {
      throw new Error('Invalid webhook payload: missing contacts array or Bid_ID');
    }

    // Get the project by CRM ID (Bid_ID)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('crm_id', payload.Bid_ID.toString())
      .single();

    if (projectError) {
      console.error('Error finding project:', projectError);
      throw new Error(`Project with Bid_ID ${payload.Bid_ID} not found`);
    }

    console.log(`Found project with ID: ${project.id} for Bid_ID: ${payload.Bid_ID}`);

    // Process each contact
    const results = await Promise.all(
      payload.contacts.map(async (contact) => {
        try {
          // Validate role
          const validRoles = ['Roofer', 'HO', 'BidList Project Manager', 'Solar'];
          // Check if role is valid, default to 'BidList Project Manager' if not
          const role = validRoles.includes(contact.role) ? contact.role : 'BidList Project Manager';
          
          // Check if contact already exists with this email or phone number
          const { data: existingContacts, error: lookupError } = await supabase
            .from('contacts')
            .select('id')
            .or(`email.eq.${contact.email},phone_number.eq.${contact.number}`);
            
          if (lookupError) {
            console.error('Error looking up existing contact:', lookupError);
            return { status: 'error', message: `Error looking up contact: ${lookupError.message}`, contact };
          }

          let contactId;
          
          if (existingContacts && existingContacts.length > 0) {
            // Use existing contact
            contactId = existingContacts[0].id;
            console.log(`Using existing contact with ID: ${contactId}`);
          } else {
            // Create new contact
            const { data: newContact, error: createError } = await supabase
              .from('contacts')
              .insert({
                full_name: contact.name,
                phone_number: contact.number,
                email: contact.email,
                role: role
              })
              .select('id')
              .single();
              
            if (createError) {
              console.error('Error creating contact:', createError);
              return { status: 'error', message: `Error creating contact: ${createError.message}`, contact };
            }
            
            contactId = newContact.id;
            console.log(`Created new contact with ID: ${contactId}`);
          }

          // Link contact to project
          const { error: linkError } = await supabase
            .from('project_contacts')
            .insert({
              project_id: project.id,
              contact_id: contactId
            });
            
          if (linkError) {
            console.error('Error linking contact to project:', linkError);
            return { status: 'error', message: `Error linking contact to project: ${linkError.message}`, contact };
          }

          return { status: 'success', contactId, contact };
        } catch (error) {
          console.error(`Error processing contact ${contact.name}:`, error);
          return { status: 'error', message: error.message, contact };
        }
      })
    );

    // Return the results
    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.filter(r => r.status === 'success').length} of ${payload.contacts.length} contacts`,
        projectId: project.id,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error processing contacts webhook:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
