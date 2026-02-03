
## Plan: Fix Request Body Structure Mismatch in Tool Invoker

### Summary

The `tool-crm-read` edge function is failing because the `mcp-tools-server` is sending the request body in a flat structure, but the tool expects a nested `args` object. This is a simple fix in `tool-invoker.ts`.

### Root Cause

**What `tool-invoker.ts` currently sends:**
```json
{
  "resource_type": "contact",
  "limit": 5,
  "securityContext": { "company_id": "...", "user_type": "system" },
  "metadata": { "orchestrator": "mcp-tools-server" }
}
```

**What `tool-crm-read` expects (per `ToolRequest` interface):**
```json
{
  "args": { "resource_type": "contact", "limit": 5 },
  "securityContext": { "company_id": "...", "user_type": "system" },
  "metadata": { "orchestrator": "mcp-tools-server" }
}
```

The tool destructures `{ securityContext, args, metadata }` from the request body, so when `args` is not present, it's `undefined`, causing `args.project_id` to throw.

### The Fix

Change `tool-invoker.ts` line 45-56 from:

```typescript
const requestBody = {
  ...args,  // WRONG: spreads at top level
  securityContext,
  metadata: { ... }
};
```

To:

```typescript
const requestBody = {
  args,     // CORRECT: nested under 'args' key
  securityContext,
  metadata: { ... }
};
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/mcp-tools-server/tool-invoker.ts` | Wrap `args` in nested object instead of spreading |

### Implementation Details

```typescript
// Line 44-56 in tool-invoker.ts
const requestBody = {
  // Wrap args in 'args' property - tools expect ToolRequest format
  args,
  // Include security context for access control
  securityContext,
  // Metadata for logging/debugging
  metadata: {
    orchestrator: 'mcp-tools-server',
    company_id: securityContext.company_id,
    timestamp: new Date().toISOString()
  }
};
```

### Post-Fix Verification

After deploying, the external agent should be able to:
1. Call `crm_read` with `{ resource_type: 'project', limit: 10 }` successfully
2. Call `crm_read` with `{ resource_type: 'contact', limit: 5 }` successfully
3. Receive actual data instead of the "Edge Function returned a non-2xx status code" error

### Technical Note

The comment in the current code says "Pass args directly - tools expect their parameters at the top level" but this is incorrect. The `ToolRequest<T>` interface in `_shared/tool-types/request-response.ts` clearly shows that tools expect `{ securityContext, args, metadata }` structure.
