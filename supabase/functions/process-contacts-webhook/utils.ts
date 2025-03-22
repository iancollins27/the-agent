
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

// Valid roles for normalization
export const validRoles = ['Roofer', 'HO', 'BidList Project Manager', 'Solar'];

// Normalize role to ensure consistent casing
export function normalizeRole(role: string): string {
  if (!role || role.trim() === '') {
    return 'Role Unknown';
  }
  
  // Check for case-insensitive matches and normalize to correct casing
  for (const validRole of validRoles) {
    if (validRole.toLowerCase() === role.toLowerCase()) {
      return validRole; // Use the properly cased version
    }
  }
  
  // Return original role if it doesn't match any known roles
  return role;
}
