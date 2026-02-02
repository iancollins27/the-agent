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
import { zodToJsonSchema } from "npm:zod-to-json-schema@3.24.1";
import { validateApiKey } from "./auth.ts";
import { invokeToolFunction } from "./tool-invoker.ts";
import { TOOL_DEFINITIONS } from "../_shared/tool-definitions/index.ts";
import { TOOL_SCHEMAS } from "./schemas.ts";

// Version tracking for deployment verification
const VERSION = "2.3.0";
const DEPLOYED_AT = new Date().toISOString();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Cache servers by enabled-tools fingerprint for session persistence
const serverCache = new Map<string, { 
  mcpServer: McpServer; 
  httpHandler: (req: Request) => Promise<Response>;
  companyId: string;
  createdAt: string;
}>();

/**
 * Generate a fingerprint from the enabled tools list for caching
 */
function getToolsFingerprint(tools: string[]): string {
  return [...tools].sort().join(',');
}

/**
 * Register a tool with mcp-lite (two-argument signature).
 */
function registerTool(
  server: McpServer,
  toolName: string,
  description: string,
  schema: z.ZodType,
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>
): { success: boolean; method?: string; error?: string } {
  try {
    const inputSchema = zodToJsonSchema(schema as z.ZodType, {
      $refStrategy: "none",
    });
    (server as any).tool(toolName, {
      description: description,
      inputSchema: inputSchema,
      handler: handler
    });
    return { success: true, method: "two-arg-signature" };
  } catch (error) {
    console.error(`[MCP Server][v${VERSION}] Tool registration failed for ${toolName}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Create and configure an MCP server with the specified tools
 */
function createMcpServer(
  enabledTools: string[],
  companyId: string
): { mcpServer: McpServer; httpHandler: (req: Request) => Promise<Response>; registrationResults: Array<{ tool: string; success: boolean; method?: string; error?: string }> } {
  
  console.log(`[MCP Server][v${VERSION}] Creating new MCP server for company ${companyId} with tools: ${enabledTools.join(', ')}`);
  
  // Create MCP server instance with schema adapter for Zod -> JSON Schema conversion
  const mcpServer = new McpServer({
    name: "external-tools-server",
    version: "1.0.0",
    schemaAdapter: (schema: unknown) => {
      if (schema && typeof schema === 'object' && '_def' in schema) {
        // Convert Zod schema to JSON Schema for MCP clients.
        return zodToJsonSchema(schema as z.ZodType, {
          $refStrategy: "none",
        });
      }
      return schema;
    },
  });

  const registrationResults: Array<{ tool: string; success: boolean; method?: string; error?: string }> = [];

  // Register the enabled tools
  for (const toolName of enabledTools) {
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

    const handler = async (args: Record<string, unknown>) => {
      console.log(`[MCP Server][v${VERSION}] Executing tool: ${toolName}`, args);
      
      try {
        const result = await invokeToolFunction(
          def.edge_function,
          args,
          {
            company_id: companyId,
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

    const result = registerTool(mcpServer, def.name, def.description, schema, handler);
    registrationResults.push({ tool: toolName, ...result });
    
    if (result.success) {
      console.log(`[MCP Server][v${VERSION}] Successfully registered ${toolName} using ${result.method}`);
    } else {
      console.error(`[MCP Server][v${VERSION}] Failed to register ${toolName}: ${result.error}`);
    }
  }

  // Create transport and bind to get the handler function
  const transport = new StreamableHttpTransport();
  const httpHandler = transport.bind(mcpServer);
  
  console.log(`[MCP Server][v${VERSION}] Transport bound, httpHandler created`);

  return { mcpServer, httpHandler, registrationResults };
}

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
    deployed_at: DEPLOYED_AT,
    cached_servers: serverCache.size
  }, 200, corsHeaders);
});

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
    const enabledTools = authResult.enabledTools || [];
    const fingerprint = getToolsFingerprint(enabledTools);
    
    // Check if we have a cached server for this tool configuration
    let cached = serverCache.get(fingerprint);
    
    if (cached) {
      console.log(`[MCP Server][v${VERSION}] Using cached server for fingerprint: ${fingerprint} (created: ${cached.createdAt})`);
    } else {
      console.log(`[MCP Server][v${VERSION}] Creating new server for fingerprint: ${fingerprint}`);
      
      const { mcpServer, httpHandler, registrationResults } = createMcpServer(
        enabledTools,
        authResult.companyId!
      );
      
      const failedTools = registrationResults.filter(r => !r.success);
      if (failedTools.length > 0) {
        console.error(`[MCP Server][v${VERSION}] Some tools failed to register:`, failedTools);
      }
      
      console.log(`[MCP Server][v${VERSION}] Tool registration complete. Success: ${registrationResults.filter(r => r.success).length}, Failed: ${failedTools.length}`);
      
      cached = {
        mcpServer,
        httpHandler,
        companyId: authResult.companyId!,
        createdAt: new Date().toISOString()
      };
      
      serverCache.set(fingerprint, cached);
      console.log(`[MCP Server][v${VERSION}] Server cached. Total cached servers: ${serverCache.size}`);
    }

    // Use the cached httpHandler to process the request
    console.log(`[MCP Server][v${VERSION}] Processing request with cached httpHandler`);
    const response = await cached.httpHandler(c.req.raw);
    
    console.log(`[MCP Server][v${VERSION}] Request handled successfully, status: ${response.status}`);
    
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
        phase: "request_handling",
        _version: VERSION,
        _deployed_at: DEPLOYED_AT
      },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
