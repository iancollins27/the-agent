
Goal
- Stop the recurring 500 error during MCP “initialize/handshake” where the server crashes with:
  - {"error":"Internal server error","details":"Cannot read properties of undefined (reading 'inputSchema')"}
- Make the server resilient to MCP client handshake patterns and easier to debug when it happens again.

What I found (from code + prior logs)
- The crash is thrown inside `mcp-lite` at `McpServer.tool(...)` while reading `inputSchema`.
- In our edge function we register tools like this:

  - `mcpServer.tool({ name, description, inputSchema, handler })`

- The specific error (“reading 'inputSchema' of undefined”) is highly consistent with a signature mismatch where the library expects something like:
  - `mcpServer.tool(name, { description, inputSchema, handler })`
  but receives the “single object” form. In that case, the library treats the first argument as `name` and the second argument (options) becomes `undefined`, then tries to read `options.inputSchema`.

Why it “came back”
- This can reappear depending on which `mcp-lite` build/runtime path is being executed (or if the deployed function isn’t the version we think it is).
- Also, because we create the `McpServer` inside the request handler, every handshake recreates and re-registers tools. Any mismatch will fail every time.

Implementation approach (safe + forward-compatible)
1) Make tool registration compatible with both possible `mcpServer.tool` call signatures.
   - Register tools using a small helper that tries the “(object)” signature first, and if it throws, falls back to “(name, options)” signature (or vice versa).
   - This avoids guessing the exact API while guaranteeing compatibility.

2) Add version logging (proven technique) so we can confirm what code is actually running when an external agent hits the endpoint.
   - Add constants like `VERSION` and `DEPLOYED_AT`.
   - Log them at the start of every request and include them in error responses (and optionally in `/health`).

3) Improve logging around tool registration to identify exactly which tool name triggered a failure.
   - Log: toolName, whether def exists, whether schema exists, and the registration method used.
   - If registration fails, log the toolName and error, then return a 500 with diagnostic info (while not leaking secrets).

4) (Optional but recommended) Move MCP server construction/registration outside the request handler to avoid repeating work and reduce chances of per-request variance.
   - If `authResult.enabledTools` differs per key, we can still keep it per-request; but we can create a per-request server while making registration robust.
   - For correctness with per-key enabled tools, we’ll keep per-request creation but ensure it can’t crash on signature mismatch.

Files to change
- `supabase/functions/mcp-tools-server/index.ts`
  - Add VERSION/DEPLOYED_AT logging
  - Add a `registerTool(server, def, schema, toolName)` helper
  - Use try/fallback registration signatures:
    - Attempt A: `server.tool({ name, description, inputSchema, handler })`
    - Attempt B: `server.tool(def.name, { description: def.description, inputSchema: schema, handler })`
  - Wrap each tool registration in its own try/catch to capture which tool fails.
  - Include `_version` info in 500 responses (and possibly in normal responses during debugging).

How we’ll verify (end-to-end)
- Trigger the MCP “initialize” handshake from your external agent / SDK.
- Confirm:
  - No more 500 during handshake
  - Tools list is returned properly
  - Logs show the version string we expect
- If it still fails:
  - The error response will include `_version` and a `failed_tool` field (or similar) so we can pinpoint it immediately.
  - We’ll check Supabase function logs for `[MCP Server][VERSION] ...` lines to confirm deployment.

Notes / edge cases
- If a key enables a tool that exists in `TOOL_DEFINITIONS` but not `TOOL_SCHEMAS`, we already `continue`; we’ll keep that but also log clearly.
- If `z.toJSONSchema` isn’t available in the deployed Zod build, it would throw a different error than “inputSchema undefined”. The version logging + improved error body will make that obvious quickly.

Deliverable
- A patched `mcp-tools-server` edge function that:
  - Registers tools successfully regardless of which `mcp-lite` tool-registration signature is active
  - Produces actionable logs and version markers so we can confirm deployments and diagnose any future handshake failures fast
