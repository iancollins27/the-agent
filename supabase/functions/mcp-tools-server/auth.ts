/**
 * API Key Authentication for Tool API server.
 *
 * Validates API keys against external access key tables and returns
 * a canonical tenant identity plus enabled tools.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  valid: boolean;
  error?: string;
  tenantId?: string;
  companyId?: string;
  orgId?: string;
  enabledTools?: string[];
}

interface KeyRecord {
  id: string;
  enabled_tools: string[] | null;
  is_active: boolean;
  expires_at: string | null;
  company_id?: string | null;
  org_id?: string | null;
}

interface KeyRecordWithSource {
  record: KeyRecord;
  table: "tool_external_access_keys" | "mcp_external_access_keys";
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
 * Lookup access key across known schema variants.
 *
 * This is an edge adapter: it normalizes storage differences
 * (table name + tenant column) into a single internal record shape.
 */
async function lookupKeyRecord(
  keyHash: string
): Promise<{ result?: KeyRecordWithSource; fatalError?: unknown }> {
  const supabase = getSupabaseClient();

  const candidates: Array<{
    table: "tool_external_access_keys" | "mcp_external_access_keys";
    select: string;
  }> = [
    {
      table: "tool_external_access_keys",
      select: "id, company_id, enabled_tools, is_active, expires_at",
    },
    {
      table: "tool_external_access_keys",
      select: "id, org_id, enabled_tools, is_active, expires_at",
    },
    {
      table: "mcp_external_access_keys",
      select: "id, company_id, enabled_tools, is_active, expires_at",
    },
    {
      table: "mcp_external_access_keys",
      select: "id, org_id, enabled_tools, is_active, expires_at",
    },
  ];

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from(candidate.table)
      .select(candidate.select)
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (error) {
      const code = (error as { code?: string }).code;
      // Missing table/column for this candidate; keep trying known variants.
      if (code === "42P01" || code === "42703") {
        continue;
      }

      console.error("[Auth] Database error:", error);
      return { fatalError: error };
    }

    if (data) {
      return {
        result: {
          table: candidate.table,
          record: data as unknown as KeyRecord,
        },
      };
    }
  }

  return {};
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

    const lookup = await lookupKeyRecord(keyHash);
    if (lookup.fatalError) {
      return { valid: false, error: "Authentication failed" };
    }

    if (!lookup.result?.record) {
      return { valid: false, error: "Invalid API key" };
    }

    const { record: keyRecord, table } = lookup.result;
    const tenantId = keyRecord.company_id ?? keyRecord.org_id ?? null;

    if (!tenantId) {
      console.error("[Auth] Access key record missing tenant identifier:", {
        keyId: keyRecord.id,
        table,
      });
      return { valid: false, error: "Authentication failed" };
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
    const supabase = getSupabaseClient();
    supabase
      .from(table)
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id)
      .then(({ error: updateError }) => {
        if (updateError) {
          console.error("[Auth] Failed to update last_used_at:", updateError);
        }
      });
    
    return {
      valid: true,
      tenantId,
      companyId: keyRecord.company_id ?? tenantId,
      ...(keyRecord.org_id ? { orgId: keyRecord.org_id } : {}),
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
