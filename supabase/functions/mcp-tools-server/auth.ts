/**
 * API Key Authentication for MCP Tools Server
 * 
 * Validates API keys against mcp_external_access_keys table and returns
 * the associated company_id and enabled tools.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  valid: boolean;
  error?: string;
  companyId?: string;
  enabledTools?: string[];
}

/**
 * Hash an API key using SHA-256
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create Supabase client with service role for full access
 */
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Validate an API key from the Authorization header
 */
export async function validateApiKey(authHeader: string | undefined): Promise<AuthResult> {
  // Check header format
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }
  
  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization header format. Expected 'Bearer <key>'" };
  }
  
  const apiKey = authHeader.slice(7).trim();
  
  if (!apiKey) {
    return { valid: false, error: "Empty API key" };
  }

  try {
    // Hash the key for lookup
    const keyHash = await hashKey(apiKey);
    
    const supabase = getSupabaseClient();
    
    // Look up the key in the database
    const { data: keyRecord, error } = await supabase
      .from("mcp_external_access_keys")
      .select("id, company_id, enabled_tools, is_active, expires_at")
      .eq("key_hash", keyHash)
      .maybeSingle();
    
    if (error) {
      console.error("[Auth] Database error:", error);
      return { valid: false, error: "Authentication failed" };
    }
    
    if (!keyRecord) {
      return { valid: false, error: "Invalid API key" };
    }
    
    // Check if key is active
    if (!keyRecord.is_active) {
      return { valid: false, error: "API key is disabled" };
    }
    
    // Check expiration
    if (keyRecord.expires_at) {
      const expiresAt = new Date(keyRecord.expires_at);
      if (expiresAt < new Date()) {
        return { valid: false, error: "API key has expired" };
      }
    }
    
    // Update last_used_at asynchronously (don't wait for it)
    supabase
      .from("mcp_external_access_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error("[Auth] Failed to update last_used_at:", updateError);
        }
      });
    
    return {
      valid: true,
      companyId: keyRecord.company_id,
      enabledTools: keyRecord.enabled_tools || []
    };
    
  } catch (error) {
    console.error("[Auth] Unexpected error:", error);
    return { valid: false, error: "Authentication failed" };
  }
}

/**
 * Generate a new API key and its hash
 * This is a utility function for creating new keys
 */
export async function generateApiKey(): Promise<{ key: string; hash: string }> {
  // Generate a random 32-byte key
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const key = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await hashKey(key);
  
  return { key, hash };
}
