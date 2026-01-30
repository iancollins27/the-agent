
## What the new logs show (different from last time)

Yes — the logs are different now. The prior failure was the `inputSchema` issue during tool registration. With the signature-agnostic registration in place, the logs show:

- `Object signature failed ... reading 'inputSchema'` (expected, because the library version wants the 2-arg signature)
- Then: `Successfully registered crm_read/crm_write using two-arg-signature` (good)
- Then the **new hard failure**:
  - `Error: Transport not bound to a server`
  - Stack: `StreamableHttpTransport.handleRequest` (mcp-lite) → our `index.ts`

So tool registration is now succeeding; the crash is happening later when handling the MCP HTTP request because the transport instance isn’t “connected/bound” to the server in the way this mcp-lite version expects.

## Likely root cause

Our edge function currently does something equivalent to:

- `const transport = new StreamableHttpTransport()`
- `await transport.handleRequest(req, mcpServer)`

But in the mcp-lite build actually running in Supabase, `StreamableHttpTransport.handleRequest(...)` appears to require that the transport be bound/connected first (e.g., `transport.bind(server)` or `await server.connect(transport)`), and then called with only the request (or with different args). If it isn’t bound, it throws: **“Transport not bound to a server”**.

This explains why external clients (Claude Agent SDK / custom framework) fail during handshake: the very first request hits `handleRequest` and the transport refuses to proceed.

## Implementation approach

We’ll update the edge function to be compatible with both mcp-lite variants by adding a “bind/connect” step before handling the request, and by calling `handleRequest` using whichever signature works.

### Key change: robust transport binding

In `supabase/functions/mcp-tools-server/index.ts`:

1. After creating `mcpServer`, create `transport`.
2. Attempt to bind/connect using multiple known patterns:
   - Pattern A: `transport.bind(mcpServer)`
   - Pattern B: `await mcpServer.connect(transport)`
3. Then handle the request using multiple known patterns:
   - Pattern A: `await transport.handleRequest(c.req.raw)` (bound transport)
   - Pattern B (fallback): `await transport.handleRequest(c.req.raw, mcpServer)` (older signature)

We’ll wrap these in try/catch with clear logs indicating which method worked, similar to the tool-registration helper you already have.

### Improve diagnostics (so we never guess again)

Add explicit logs around:
- “transport bind/connect started”
- “transport bound via: ___”
- “handleRequest succeeded via: ___”
- If it fails, return 500 including `_version`, `_deployed_at`, and a short `phase` field like `"phase": "transport_bind"` or `"phase": "handle_request"` (no secrets).

### Optional safety improvement (if needed)

If mcp-lite’s transport maintains per-connection state, we may need to instantiate/bind the transport **per request** (which we already do), not globally. We’ll keep it per-request unless logs indicate otherwise.

## Step-by-step plan

1. **Inspect current edge function implementation**
   - Confirm current call is `transport.handleRequest(c.req.raw, mcpServer)` and that we never call `bind()` / `connect()`.

2. **Update `mcp-tools-server/index.ts`**
   - Add a `bindTransport()` helper that tries:
     - `transport.bind(mcpServer)` (if present)
     - `await mcpServer.connect(transport)` (if present)
   - Add a `handleMcpRequest()` helper that tries:
     - `transport.handleRequest(c.req.raw)` first
     - fallback `transport.handleRequest(c.req.raw, mcpServer)`
   - Add logs for which methods were used.
   - Ensure CORS behavior remains unchanged.

3. **Deploy and verify using logs**
   - Trigger the handshake again from the Claude Agent SDK/custom agent.
   - Confirm the function logs show:
     - tool registration success
     - transport bound
     - no “Transport not bound” error
   - If it still fails, the returned JSON error will show `phase` and the logs will show which bind/handle signature failed.

## Acceptance criteria

- External MCP client can complete the initial handshake (initialize/tools discovery) without HTTP 500.
- The edge function logs show a successful transport binding method and a successful handleRequest method.
- Existing API-key auth behavior remains unchanged.

## Files involved

- `supabase/functions/mcp-tools-server/index.ts` (edit only)

## Notes / risks

- mcp-lite’s API has changed across versions; this plan intentionally avoids “assuming” one signature by trying both.
- If the client requires specific MCP protocol version negotiation, we may need to set server protocol options, but the current error is clearly pre-protocol (transport setup), so binding is the correct next fix.
