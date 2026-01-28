

## MCP Server for External Agent Access

This plan creates an MCP server edge function that exposes your CRM tools (and other tools) to external AI agents like Claude Desktop, Cursor, or custom applications.

---

## Overview

```text
┌──────────────────────────┐         ┌────────────────────────────────┐
│   External AI Agent      │         │   Supabase Edge Functions      │
│   (Claude, Cursor, etc.) │─────────│   mcp-tools-server             │
└──────────────────────────┘   MCP   └────────────┬───────────────────┘
                                                  │ Validates API key
                                                  │ Maps to company_id
                                                  │ Checks enabled_tools
                                     ┌────────────┴────────────────────┐
                                     │                                 │
                                     v                                 v
                              ┌──────────────┐                 ┌──────────────┐
                              │ tool-crm-read│                 │tool-crm-write│
                              └──────────────┘                 └──────────────┘
```

---

## Database Changes

### New Table: `mcp_external_access_keys`

A clearly-named table specifically for authenticating external AI agents connecting via MCP:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `company_id` | uuid | Links to company for data isolation |
| `key_hash` | text | SHA-256 hash of the API key (we never store the raw key) |
| `key_name` | text | Human-readable name (e.g., "Claude Desktop - John's Mac") |
| `enabled_tools` | text[] | Whitelist of tools this key can access |
| `is_active` | boolean | Enable/disable without deleting |
| `rate_limit_per_minute` | integer | Optional rate limiting |
| `last_used_at` | timestamptz | Track usage for auditing |
| `expires_at` | timestamptz | Optional expiration |
| `created_at` | timestamptz | Creation timestamp |
| `created_by` | uuid | Which profile created this key |

**RLS Policies:**
- Users can manage keys for their own company
- Service role has full access for the MCP server edge function

---

## New Edge Function: `mcp-tools-server`

### File Structure

```text
supabase/functions/mcp-tools-server/
├── index.ts          # Main Hono + mcp-lite server
├── auth.ts           # API key validation and company lookup
├── tool-invoker.ts   # Calls existing tool edge functions
└── deno.json         # Import map with mcp-lite
```

### Key Implementation Details

**1. Authentication Flow**
- External agent sends API key in `Authorization: Bearer <key>` header
- Server hashes the key and looks up `mcp_external_access_keys`
- Extracts `company_id` and `enabled_tools` from the matching row
- Updates `last_used_at` for auditing

**2. Tool Registration**
- Imports `TOOL_DEFINITIONS` from `_shared/tool-definitions`
- Registers each tool with mcp-lite using the existing schema
- Filters tools based on `enabled_tools` for the authenticated key

**3. Tool Execution**
- When agent calls a tool, server builds `ToolSecurityContext` with the company_id
- Invokes the existing edge function (e.g., `tool-crm-read`)
- Returns result in MCP format

---

## Security Considerations

1. **Company Isolation**: API key maps to a single company - all data access is scoped
2. **Tool Whitelisting**: Each key can only access tools in its `enabled_tools` array
3. **Key Hashing**: We store SHA-256 hash, not the raw key
4. **Audit Trail**: `last_used_at` tracks when keys are used
5. **Revocation**: Set `is_active = false` to immediately disable
6. **Expiration**: Optional `expires_at` for time-limited access

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/mcp-tools-server/index.ts` | Create | MCP server with Hono routing |
| `supabase/functions/mcp-tools-server/auth.ts` | Create | API key validation logic |
| `supabase/functions/mcp-tools-server/tool-invoker.ts` | Create | Delegates to existing tool functions |
| `supabase/functions/mcp-tools-server/deno.json` | Create | Import map for mcp-lite |

---

## Technical Details

### deno.json Import Map

```json
{
  "imports": {
    "hono": "jsr:@hono/hono",
    "mcp-lite": "npm:mcp-lite@^0.10.0"
  }
}
```

### MCP Server Setup (index.ts)

```typescript
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { validateApiKey } from "./auth.ts";
import { invokeToolFunction } from "./tool-invoker.ts";
import { TOOL_DEFINITIONS } from "../_shared/tool-definitions/index.ts";

const app = new Hono();

app.all("/*", async (c) => {
  // 1. Validate API key from Authorization header
  const authResult = await validateApiKey(c.req.header("Authorization"));
  if (!authResult.valid) {
    return c.json({ error: authResult.error }, 401);
  }
  
  // 2. Create MCP server with only enabled tools
  const mcpServer = new McpServer({
    name: "your-company-tools",
    version: "1.0.0"
  });
  
  // 3. Register enabled tools
  for (const toolName of authResult.enabledTools) {
    const def = TOOL_DEFINITIONS[toolName];
    if (!def) continue;
    
    mcpServer.tool({
      name: def.name,
      description: def.description,
      inputSchema: def.schema,
      handler: async (args) => {
        const result = await invokeToolFunction(
          def.edge_function,
          args,
          { company_id: authResult.companyId, user_type: 'system' }
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      }
    });
  }
  
  // 4. Handle MCP request
  const transport = new StreamableHttpTransport();
  return transport.handleRequest(c.req.raw, mcpServer);
});

Deno.serve(app.fetch);
```

### API Key Validation (auth.ts)

```typescript
export async function validateApiKey(authHeader: string | undefined): Promise<AuthResult> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }
  
  const apiKey = authHeader.slice(7);
  const keyHash = await hashKey(apiKey);
  
  const { data: keyRecord, error } = await supabase
    .from("mcp_external_access_keys")
    .select("company_id, enabled_tools, is_active, expires_at")
    .eq("key_hash", keyHash)
    .single();
  
  if (error || !keyRecord) {
    return { valid: false, error: "Invalid API key" };
  }
  
  if (!keyRecord.is_active) {
    return { valid: false, error: "API key is disabled" };
  }
  
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }
  
  // Update last_used_at
  await supabase
    .from("mcp_external_access_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("key_hash", keyHash);
  
  return {
    valid: true,
    companyId: keyRecord.company_id,
    enabledTools: keyRecord.enabled_tools
  };
}
```

---

## Usage by External Agents

Once deployed, external AI agents can connect using:

**MCP Server URL:**
```
https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/mcp-tools-server
```

**Headers:**
```
Authorization: Bearer <api_key>
```

The agent will automatically discover available tools via MCP's tool listing protocol.

---

## Future Enhancements (Not in This Plan)

- Admin UI page to create/manage API keys
- Rate limiting enforcement
- More detailed audit logging to `audit_log` table
- OAuth flow for more complex auth scenarios

