/**
 * MCP Tools Server - Exposes tools to external AI agents via MCP protocol
 * 
 * External agents (Claude Desktop, Cursor, etc.) can connect using:
 * URL: https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/mcp-tools-server
 * Header: Authorization: Bearer <api_key>
 */

import { Hono } from "jsr:@hono/hono";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { validateApiKey, AuthResult } from "./auth.ts";
import { invokeToolFunction } from "./tool-invoker.ts";
import { TOOL_DEFINITIONS } from "../_shared/tool-definitions/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const app = new Hono();

// Handle CORS preflight
app.options("/*", (c) => {
  return new Response("ok", { headers: corsHeaders });
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "mcp-tools-server" }, 200, corsHeaders);
});

// Main MCP handler
app.all("/*", async (c) => {
  console.log(`[MCP Server] Received ${c.req.method} request`);
  
  // Validate API key
  const authResult = await validateApiKey(c.req.header("Authorization"));
  
  if (!authResult.valid) {
    console.log(`[MCP Server] Auth failed: ${authResult.error}`);
    return c.json(
      { error: authResult.error },
      401,
      corsHeaders
    );
  }

  console.log(`[MCP Server] Auth successful for company: ${authResult.companyId}`);
  console.log(`[MCP Server] Enabled tools: ${authResult.enabledTools?.join(", ")}`);

  try {
    // Create MCP server instance
    const mcpServer = new McpServer({
      name: "external-tools-server",
      version: "1.0.0",
    });

    // Register only the enabled tools for this API key
    for (const toolName of authResult.enabledTools || []) {
      const def = TOOL_DEFINITIONS[toolName];
      if (!def) {
        console.log(`[MCP Server] Tool not found in definitions: ${toolName}`);
        continue;
      }

      console.log(`[MCP Server] Registering tool: ${toolName}`);

      mcpServer.tool({
        name: def.name,
        description: def.description,
        inputSchema: def.schema,
        handler: async (args: Record<string, unknown>) => {
          console.log(`[MCP Server] Executing tool: ${toolName}`, args);
          
          try {
            const result = await invokeToolFunction(
              def.edge_function,
              args,
              {
                company_id: authResult.companyId!,
                user_type: 'system'
              }
            );

            console.log(`[MCP Server] Tool ${toolName} completed successfully`);
            
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify(result, null, 2)
              }]
            };
          } catch (error) {
            console.error(`[MCP Server] Tool ${toolName} failed:`, error);
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  error: true,
                  message: error instanceof Error ? error.message : "Unknown error"
                })
              }],
              isError: true
            };
          }
        }
      });
    }

    // Handle MCP request using StreamableHttpTransport
    const transport = new StreamableHttpTransport();
    const response = await transport.handleRequest(c.req.raw, mcpServer);
    
    // Add CORS headers to the response
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      headers
    });

  } catch (error) {
    console.error("[MCP Server] Error handling request:", error);
    return c.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
