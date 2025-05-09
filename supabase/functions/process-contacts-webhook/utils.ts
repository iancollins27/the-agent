
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize Supabase client
export function initSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

// Retrieve valid roles from the database
export async function getValidRoles(supabase) {
  try {
    // Query the Postgres system catalog to get enum values
    const { data, error } = await supabase.rpc('get_enum_values', {
      enum_name: 'contact_role'
    });

    if (error) {
      console.error('Error fetching enum values:', error);
      // Return empty array as fallback
      return [];
    }

    console.log('Retrieved valid roles from database:', data);
    return data || [];
  } catch (error) {
    console.error('Exception when fetching enum values:', error);
    return [];
  }
}

// Normalize role to ensure it matches a valid database enum value
export async function normalizeRole(supabase, role: string): Promise<string> {
  if (!role || role.trim() === '') {
    return 'Role Unknown';
  }
  
  // Get valid roles from the database
  const validRoles = await getValidRoles(supabase);
  
  // Convert input to lowercase for case-insensitive matching
  const roleLower = role.toLowerCase().trim();
  
  // Check for exact matches with validRoles (case-insensitive)
  for (const validRole of validRoles) {
    if (validRole.toLowerCase() === roleLower) {
      return validRole; // Use the properly cased version from the database
    }
  }
  
  // Return default value if no match found
  console.log(`Role not matched with any valid enum value: "${role}", using default`);
  return 'Role Unknown';
}
