/**
 * MCP Tools Server - Exposes tools to external AI agents via MCP protocol
 * 
 * External agents (Claude Desktop, Cursor, etc.) can connect using:
 * URL: https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/mcp-tools-server
 * Header: Authorization: Bearer <api_key>
 */

import { Hono } from "jsr:@hono/hono";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { z } from "npm:zod@3.23.8";
import { validateApiKey } from "./auth.ts";
import { invokeToolFunction } from "./tool-invoker.ts";
import { TOOL_DEFINITIONS } from "../_shared/tool-definitions/index.ts";
import { TOOL_SCHEMAS } from "./schemas.ts";

// Version tracking for deployment verification
const VERSION = "2.1.0";
const DEPLOYED_AT = new Date().toISOString();

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

// Health check endpoint with version info
app.get("/health", (c) => {
  return c.json({ 
    status: "ok", 
    service: "mcp-tools-server",
    version: VERSION,
    deployed_at: DEPLOYED_AT
  }, 200, corsHeaders);
});

/**
 * Register a tool with mcp-lite using signature-agnostic approach.
 * Tries both known signatures to ensure compatibility across mcp-lite versions.
 */
function registerTool(
  server: McpServer,
  toolName: string,
  description: string,
  schema: z.ZodType,
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>
): { success: boolean; method?: string; error?: string } {
  // Attempt A: Single object signature { name, description, inputSchema, handler }
  try {
    server.tool({
      name: toolName,
      description: description,
      inputSchema: schema,
      handler: handler
    });
    return { success: true, method: "object-signature" };
  } catch (errorA) {
    console.log(`[MCP Server][v${VERSION}] Object signature failed for ${toolName}:`, errorA);
    
    // Attempt B: Two-argument signature (name, { description, inputSchema, handler })
    try {
      (server as any).tool(toolName, {
        description: description,
        inputSchema: schema,
        handler: handler
      });
      return { success: true, method: "two-arg-signature" };
    } catch (errorB) {
      console.error(`[MCP Server][v${VERSION}] Both signatures failed for ${toolName}:`, {
        objectSignatureError: errorA instanceof Error ? errorA.message : String(errorA),
        twoArgSignatureError: errorB instanceof Error ? errorB.message : String(errorB)
      });
      return { 
        success: false, 
        error: `Object: ${errorA instanceof Error ? errorA.message : String(errorA)}; TwoArg: ${errorB instanceof Error ? errorB.message : String(errorB)}`
      };
    }
  }
}

// Main MCP handler
app.all("/*", async (c) => {
  console.log(`[MCP Server][v${VERSION}] Received ${c.req.method} request at ${new Date().toISOString()}`);
  
  // Validate API key
  const authResult = await validateApiKey(c.req.header("Authorization"));
  
  if (!authResult.valid) {
    console.log(`[MCP Server][v${VERSION}] Auth failed: ${authResult.error}`);
    return c.json(
      { error: authResult.error, _version: VERSION },
      401,
      corsHeaders
    );
  }

  console.log(`[MCP Server][v${VERSION}] Auth successful for company: ${authResult.companyId}`);
  console.log(`[MCP Server][v${VERSION}] Enabled tools: ${authResult.enabledTools?.join(", ")}`);

  try {
    // Create MCP server instance with schema adapter for Zod -> JSON Schema conversion
    const mcpServer = new McpServer({
      name: "external-tools-server",
      version: "1.0.0",
      schemaAdapter: (schema: unknown) => {
        // Convert Zod schema to JSON Schema for MCP protocol
        if (schema && typeof schema === 'object' && '_def' in schema) {
          return z.toJSONSchema(schema as z.ZodType);
        }
        return schema;
      },
    });

    const registrationResults: Array<{ tool: string; success: boolean; method?: string; error?: string }> = [];

    // Register only the enabled tools for this API key
    for (const toolName of authResult.enabledTools || []) {
      const def = TOOL_DEFINITIONS[toolName];
      const schema = TOOL_SCHEMAS[toolName];
      
      if (!def) {
        console.log(`[MCP Server][v${VERSION}] Tool definition not found: ${toolName}`);
        registrationResults.push({ tool: toolName, success: false, error: "definition_not_found" });
        continue;
      }
      
      if (!schema) {
        console.log(`[MCP Server][v${VERSION}] Schema not found for tool: ${toolName}`);
        registrationResults.push({ tool: toolName, success: false, error: "schema_not_found" });
        continue;
      }

      console.log(`[MCP Server][v${VERSION}] Registering tool: ${toolName}`);

      // Create the handler for this tool
      const handler = async (args: Record<string, unknown>) => {
        console.log(`[MCP Server][v${VERSION}] Executing tool: ${toolName}`, args);
        
        try {
          const result = await invokeToolFunction(
            def.edge_function,
            args,
            {
              company_id: authResult.companyId!,
              user_type: 'system'
            }
          );

          console.log(`[MCP Server][v${VERSION}] Tool ${toolName} completed successfully`);
          
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error(`[MCP Server][v${VERSION}] Tool ${toolName} failed:`, error);
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
      };

      // Use signature-agnostic registration
      const result = registerTool(mcpServer, def.name, def.description, schema, handler);
      registrationResults.push({ tool: toolName, ...result });
      
      if (result.success) {
        console.log(`[MCP Server][v${VERSION}] Successfully registered ${toolName} using ${result.method}`);
      } else {
        console.error(`[MCP Server][v${VERSION}] Failed to register ${toolName}: ${result.error}`);
      }
    }

    // Check if any tools failed to register
    const failedTools = registrationResults.filter(r => !r.success);
    if (failedTools.length > 0) {
      console.error(`[MCP Server][v${VERSION}] Some tools failed to register:`, failedTools);
    }

    console.log(`[MCP Server][v${VERSION}] Tool registration complete. Success: ${registrationResults.filter(r => r.success).length}, Failed: ${failedTools.length}`);

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
    console.error(`[MCP Server][v${VERSION}] Error handling request:`, error);
    return c.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error",
        _version: VERSION,
        _deployed_at: DEPLOYED_AT
      },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
