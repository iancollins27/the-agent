
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

// Valid roles for reference only (not used for normalization anymore)
export const validRoles = ['Roofer', 'HO', 'BidList Project Manager', 'Solar'];

// Role mapping is kept for reference but not used in the main logic anymore
export const roleMapping: Record<string, string> = {
  // Homeowner variations
  'homeowner': 'HO',
  'home owner': 'HO',
  'ho': 'HO',
  'customer': 'HO',
  'client': 'HO',
  
  // Roofer variations
  'roofer': 'Roofer',
  'roofing contractor': 'Roofer',
  'roofing': 'Roofer',
  'contractor': 'Roofer',
  
  // Solar variations
  'solar': 'Solar',
  'solar sales rep': 'Solar',
  'solar rep': 'Solar',
  'solar consultant': 'Solar',
  'solar installer': 'Solar',
  
  // Project Manager variations
  'bidlist project manager': 'BidList Project Manager',
  'project manager': 'BidList Project Manager',
  'pm': 'BidList Project Manager',
  'manager': 'BidList Project Manager',
  'bidlist': 'BidList Project Manager',
};

// This function is kept for backward compatibility but now just returns the original role
// without any normalization, or 'HO' if the role is missing
export function normalizeRole(role: string): string {
  // If role is undefined or empty, return 'HO' as the default role
  if (!role || role.trim() === '') {
    console.log('No role provided, using default "HO"');
    return 'HO';
  }
  
  // Just return the original role without any normalization
  console.log(`Using original role as provided: "${role}"`);
  return role;
}
