
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

    // Get content type to determine how to parse the body
    const contentType = req.headers.get('content-type') || '';
    console.log('Content-Type:', contentType);

    // Get the raw request body
    const requestText = await req.text();
    console.log('Raw request body:', requestText);
    
    // Parse payload based on content type
    let payload: WebhookPayload;
    try {
      if (contentType.includes('application/json')) {
        // Parse as JSON
        payload = JSON.parse(requestText);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        // Parse as form data
        const formData = new URLSearchParams(requestText);
        
        // Check if the entire payload is in a single form field (Zoho might do this)
        if (formData.has('payload')) {
          payload = JSON.parse(formData.get('payload') || '{}');
        } else if (formData.has('contacts')) {
          // Try to parse contacts as JSON if it's in a single parameter
          try {
            const contacts = JSON.parse(formData.get('contacts') || '[]');
            const bidId = formData.get('Bid_ID') || '';
            payload = {
              contacts: Array.isArray(contacts) ? contacts : [],
              Bid_ID: parseInt(bidId, 10)
            };
          } catch {
            // If contacts can't be parsed as JSON, try to reconstruct from form data
            console.log('Reconstructing payload from form data');
            payload = {
              contacts: [],
              Bid_ID: parseInt(formData.get('Bid_ID') || '0', 10)
            };
            
            // Zoho might send data with indices like contacts[0][name], contacts[0][email], etc.
            // We need to reconstruct the contacts array
            const contactIndices = new Set<number>();
            for (const [key, value] of formData.entries()) {
              const match = key.match(/contacts\[(\d+)\]\[(\w+)\]/);
              if (match) {
                const index = parseInt(match[1], 10);
                contactIndices.add(index);
              }
            }
            
            if (contactIndices.size > 0) {
              for (const index of contactIndices) {
                const contact: ContactPayload = {
                  name: formData.get(`contacts[${index}][name]`) || '',
                  number: formData.get(`contacts[${index}][number]`) || '',
                  email: formData.get(`contacts[${index}][email]`) || '',
                  role: formData.get(`contacts[${index}][role]`) || ''
                };
                payload.contacts.push(contact);
              }
            }
          }
        } else {
          throw new Error('Unable to find contacts or payload in form data');
        }
      } else {
        // Try JSON parse as fallback
        try {
          payload = JSON.parse(requestText);
        } catch {
          throw new Error(`Unsupported content type: ${contentType}`);
        }
      }
      
      console.log('Parsed webhook payload:', payload);
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error(`Invalid request body format: ${parseError.message}`);
    }
    
    // Validate the payload
    if (!payload.contacts || !Array.isArray(payload.contacts) || !payload.Bid_ID) {
      throw new Error('Invalid webhook payload: missing contacts array or Bid_ID');
    }

    // Get the project by CRM ID (Bid_ID)
    console.log(`Looking for project with CRM ID: ${payload.Bid_ID}`);
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('crm_id', payload.Bid_ID.toString())
      .single();

    if (projectError) {
      console.error('Error finding project:', projectError);
      throw new Error(`Project with Bid_ID ${payload.Bid_ID} not found: ${projectError.message}`);
    }

    console.log(`Found project with ID: ${project.id} for Bid_ID: ${payload.Bid_ID}`);

    // Process each contact
    const results = await Promise.all(
      payload.contacts.map(async (contact) => {
        try {
          console.log(`Processing contact: ${contact.name}, ${contact.email}, ${contact.number}, role: ${contact.role}`);
          
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
            console.log(`Creating new contact: ${contact.name}`);
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

          // Check if contact is already linked to project
          const { data: existingLink, error: linkCheckError } = await supabase
            .from('project_contacts')
            .select('*')
            .eq('project_id', project.id)
            .eq('contact_id', contactId);
            
          if (linkCheckError) {
            console.error('Error checking existing project-contact link:', linkCheckError);
          } 
          
          // Only create the link if it doesn't already exist
          if (!existingLink || existingLink.length === 0) {
            console.log(`Linking contact ${contactId} to project ${project.id}`);
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
          } else {
            console.log(`Contact ${contactId} already linked to project ${project.id}`);
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
