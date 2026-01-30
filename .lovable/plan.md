

## Fix: MCP Server Returns Empty Tools List

### Problem Identified

The logs show tool registration succeeds but the external agent sees `mcpTools: []` (empty). This is caused by **incorrect usage of the mcp-lite API**:

1. **Wrong pattern for handling requests**: The official Supabase documentation shows `transport.bind(mcp)` returns a **handler function** that should be used to process requests. Our code calls `bind()` but ignores the return value, then calls `handleRequest()` separately.

2. **Per-request server creation**: Our code creates a new `McpServer` instance for every HTTP request. The MCP protocol involves multiple request-response cycles (initialize → tools/list → tool calls). If each request creates a new server, the tools registered in request #1 are lost when request #2 arrives.

### Evidence from Logs

The logs show the pattern repeating for every request:
```
Registering tool: crm_read
Registering tool: crm_write
Tool registration complete. Success: 2, Failed: 0
Transport bound via: transport.bind(server)
Request handled successfully
```

This happens 3+ times in quick succession - each initialize/tools/list cycle is hitting a fresh server instance.

### Root Cause: API Misuse

**Current code (incorrect)**:
```typescript
app.all("/*", async (c) => {
  // Creates NEW server every request
  const mcpServer = new McpServer({...});
  
  // Register tools on this ephemeral server
  for (const toolName of enabledTools) {
    mcpServer.tool(...);
  }
  
  const transport = new StreamableHttpTransport();
  transport.bind(mcpServer);  // Ignores returned handler!
  
  await transport.handleRequest(c.req.raw);  // Wrong - should use returned handler
});
```

**Official Supabase pattern (correct)**:
```typescript
// Module level - created once
const mcp = new McpServer({...});
mcp.tool('sum', {...});  // Tools registered once

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);  // Capture the handler!

// Request handler uses the pre-built httpHandler
mcpApp.all('/mcp', async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});
```

### Challenge: Per-API-Key Tool Filtering

Our server needs to filter tools based on which API key is used. We can't create a single global server because different API keys have different `enabledTools` lists.

### Solution: Session-Based Server Caching

We'll implement a session-aware pattern that:
1. Creates one `McpServer` + `httpHandler` per unique `enabledTools` configuration
2. Caches these servers so the same API key reuses the same server instance
3. Falls back to per-request creation if needed, but uses the **correct** `httpHandler` pattern

### Implementation Plan

| Step | File | Change |
|------|------|--------|
| 1 | `mcp-tools-server/index.ts` | Update to use `transport.bind()` return value correctly |
| 2 | `mcp-tools-server/index.ts` | Add server caching by tools fingerprint |
| 3 | `mcp-tools-server/index.ts` | Bump version to 2.3.0 for tracking |

### Detailed Code Changes

**1. Fix the httpHandler pattern:**
```typescript
// Create transport and get handler function
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcpServer);  // THIS returns the handler!

// Use the handler to process the request
const response = await httpHandler(c.req.raw);
```

**2. Add server caching by enabled-tools fingerprint:**
```typescript
// Cache servers by enabled-tools hash
const serverCache = new Map<string, { 
  mcpServer: McpServer; 
  httpHandler: (req: Request) => Promise<Response>;
}>();

function getToolsFingerprint(tools: string[]): string {
  return [...tools].sort().join(',');
}

// In request handler:
const fingerprint = getToolsFingerprint(authResult.enabledTools || []);
let cached = serverCache.get(fingerprint);

if (!cached) {
  const mcpServer = new McpServer({...});
  // Register tools...
  const transport = new StreamableHttpTransport();
  const httpHandler = transport.bind(mcpServer);
  cached = { mcpServer, httpHandler };
  serverCache.set(fingerprint, cached);
}

return cached.httpHandler(c.req.raw);
```

### Why This Will Work

1. **Persistent servers**: The same `McpServer` instance handles all requests for a given API key, so tools registered during initialization are still there when `tools/list` is called.

2. **Correct API usage**: Using `transport.bind()` return value as the request handler matches the official documentation.

3. **Multi-tenant support**: Different API keys with different tool configurations get their own cached servers.

### Technical Details

- The cache is per-Deno-isolate, which means each edge function instance maintains its own cache
- If an isolate restarts, servers are recreated on first request (this is fine)
- Cache entries are keyed by sorted tool names, so `['crm_read', 'crm_write']` and `['crm_write', 'crm_read']` use the same server

### Testing

After deployment:
1. External agent should see `mcpTools: [crm_read, crm_write]` (or whatever tools are enabled)
2. Logs should show "Using cached server" on subsequent requests from the same API key
3. Tool invocation should work end-to-end

