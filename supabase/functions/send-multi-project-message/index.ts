
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, rooferName, projectIds } = await req.json();
    
    if (!message || !rooferName || !projectIds) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Sending multi-project message to ${rooferName} for ${projectIds.length} projects`);

    // Create a Supabase client using the service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch contact information for the roofer
    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, phone_number, email')
      .eq('full_name', rooferName)
      .eq('role', 'Roofer')
      .limit(1)
      .single();

    if (contactError) {
      throw new Error(`Error fetching contact information: ${contactError.message}`);
    }

    if (!contacts) {
      throw new Error(`No contact information found for roofer: ${rooferName}`);
    }

    // 2. Create a communication record
    const communicationData = {
      type: 'SMS', // Default to SMS, but could be configurable
      subtype: 'MULTI_PROJECT',
      direction: 'outbound',
      participants: [
        {
          type: 'phone',
          value: contacts.phone_number,
          role: 'recipient'
        }
      ],
      content: message,
      timestamp: new Date().toISOString()
    };

    const { data: commRecord, error: commError } = await supabase
      .from('communications')
      .insert([communicationData])
      .select()
      .single();

    if (commError) {
      throw new Error(`Error creating communication record: ${commError.message}`);
    }

    // 3. Create action records for each project
    const actionPromises = projectIds.map(projectId => {
      return supabase
        .from('action_records')
        .insert([{
          project_id: projectId,
          action_type: 'send_multi_project_message',
          status: 'completed',
          message: message,
          recipient_id: contacts.id,
          action_payload: {
            communication_id: commRecord.id,
            recipient_name: rooferName,
            project_count: projectIds.length
          },
          executed_at: new Date().toISOString()
        }]);
    });

    await Promise.all(actionPromises);

    // 4. Forward the message to the communication service
    // This would typically call another edge function or service to actually send the message
    const { error: sendError } = await supabase.functions.invoke('send-communication', {
      body: {
        type: 'SMS',
        to: contacts.phone_number,
        content: message,
        communication_id: commRecord.id
      }
    });

    if (sendError) {
      throw new Error(`Error sending message: ${sendError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Message sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-multi-project-message function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to create a Supabase client
function createClient(supabaseUrl: string, supabaseKey: string) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: any) => ({
          eq: (column: string, value: any) => ({
            limit: (limit: number) => ({
              single: () => new Promise((resolve) => {
                // Mock implementation for type checking - this will be replaced by actual Supabase client
                resolve({ data: null, error: null });
              })
            })
          }),
          limit: (limit: number) => ({
            single: () => new Promise((resolve) => {
              // Mock implementation for type checking - this will be replaced by actual Supabase client
              resolve({ data: null, error: null });
            })
          })
        }),
        single: () => new Promise((resolve) => {
          // Mock implementation for type checking - this will be replaced by actual Supabase client
          resolve({ data: null, error: null });
        })
      }),
      insert: (data: any[]) => ({
        select: () => ({
          single: () => new Promise((resolve) => {
            // Mock implementation for type checking - this will be replaced by actual Supabase client
            resolve({ data: null, error: null });
          })
        })
      })
    }),
    functions: {
      invoke: (name: string, { body }: { body: any }) => new Promise((resolve) => {
        // Mock implementation for type checking - this will be replaced by actual Supabase client
        resolve({ data: null, error: null });
      })
    }
  };
}
