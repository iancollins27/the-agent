
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

// Role mapping to handle common variations
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

// Normalize role to ensure consistent casing and handle variations
export function normalizeRole(role: string): string {
  if (!role || role.trim() === '') {
    return 'Role Unknown';
  }
  
  // Convert to lowercase for case-insensitive matching
  const roleLower = role.toLowerCase().trim();
  
  // Check for exact matches in our mapping
  if (roleMapping[roleLower]) {
    return roleMapping[roleLower];
  }
  
  // Check for partial matches in our mapping
  for (const [key, value] of Object.entries(roleMapping)) {
    if (roleLower.includes(key)) {
      return value;
    }
  }
  
  // Check for case-insensitive matches with validRoles
  for (const validRole of validRoles) {
    if (validRole.toLowerCase() === roleLower) {
      return validRole; // Use the properly cased version
    }
  }
  
  // Return original role if it doesn't match any known roles
  console.log(`Role not mapped: "${role}", using default`);
  return 'Role Unknown';
}
