/**
 * Tool API Server - Exposes tools over a simple JSON HTTP API
 *
 * Endpoint:
 *   https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/mcp-tools-server
 * Auth:
 *   Authorization: Bearer <api_key>
 */

import { Hono } from "jsr:@hono/hono";
import { validateApiKey } from "./auth.ts";
import { invokeToolFunction } from "./tool-invoker.ts";
import { TOOL_DEFINITIONS } from "../_shared/tool-definitions/index.ts";
import { TOOL_SCHEMAS } from "./schemas.ts";

const VERSION = "3.0.0";
const DEPLOYED_AT = new Date().toISOString();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface ExecuteBody {
  tool?: string;
  args?: Record<string, unknown>;
  project_id?: string;
  user_type?: "system" | "admin" | "contact";
  user_id?: string;
  contact_id?: string;
}

const app = new Hono();

app.options("/*", () => new Response("ok", { headers: corsHeaders }));

app.get("/health", (c) => {
  return c.json(
    {
      status: "ok",
      service: "tool-api-server",
      version: VERSION,
      deployed_at: DEPLOYED_AT,
    },
    200,
    corsHeaders
  );
});

async function authenticate(c: any): Promise<
  | { ok: true; tenantId: string; companyId?: string; orgId?: string; enabledTools: string[] }
  | { ok: false; response: Response }
> {
  const authResult = await validateApiKey(c.req.header("Authorization"));
  if (!authResult.valid || !authResult.tenantId) {
    return {
      ok: false,
      response: c.json(
        { ok: false, error: authResult.error || "Unauthorized", version: VERSION },
        401,
        corsHeaders
      ),
    };
  }
  return {
    ok: true,
    tenantId: authResult.tenantId,
    companyId: authResult.companyId,
    orgId: authResult.orgId,
    enabledTools: authResult.enabledTools || [],
  };
}

app.get("/tools", async (c) => {
  const auth = await authenticate(c);
  if (!auth.ok) return auth.response;

  const tools = auth.enabledTools
    .filter((name) => name in TOOL_DEFINITIONS)
    .map((name) => {
      const def = TOOL_DEFINITIONS[name];
      return {
        name: def.name,
        description: def.description,
        parameters: def.schema,
      };
    });

  return c.json(
    {
      ok: true,
      tools,
      count: tools.length,
      version: VERSION,
    },
    200,
    corsHeaders
  );
});

app.post("/execute", async (c) => {
  const auth = await authenticate(c);
  if (!auth.ok) return auth.response;

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const body = (await c.req.json()) as ExecuteBody;
    const toolName = body.tool;
    const rawArgs = body.args || {};

    if (!toolName) {
      return c.json(
        { ok: false, error: "Missing required field: tool", request_id: requestId, version: VERSION },
        400,
        corsHeaders
      );
    }

    if (!auth.enabledTools.includes(toolName)) {
      return c.json(
        { ok: false, error: `Tool not enabled: ${toolName}`, request_id: requestId, version: VERSION },
        403,
        corsHeaders
      );
    }

    const def = TOOL_DEFINITIONS[toolName];
    const schema = TOOL_SCHEMAS[toolName];
    if (!def || !schema) {
      return c.json(
        { ok: false, error: `Unknown tool: ${toolName}`, request_id: requestId, version: VERSION },
        404,
        corsHeaders
      );
    }

    const parseResult = schema.safeParse(rawArgs);
    if (!parseResult.success) {
      return c.json(
        {
          ok: false,
          error: "Invalid tool arguments",
          details: parseResult.error.issues,
          request_id: requestId,
          version: VERSION,
        },
        400,
        corsHeaders
      );
    }

    const result = await invokeToolFunction(def.edge_function, parseResult.data as Record<string, unknown>, {
      // Canonical tenant context for the internal model.
      tenant_id: auth.tenantId,
      // Backward-compat for existing tool functions that still expect company_id.
      company_id: auth.companyId || auth.tenantId,
      ...(auth.orgId ? { org_id: auth.orgId } : {}),
      user_type: body.user_type || "system",
      ...(body.user_id ? { user_id: body.user_id } : {}),
      ...(body.contact_id ? { contact_id: body.contact_id } : {}),
      ...(body.project_id ? { project_id: body.project_id } : {}),
    });

    return c.json(
      {
        ok: true,
        tool: toolName,
        result,
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
        version: VERSION,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("[Tool API] Execute error:", error);
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
        request_id: requestId,
        duration_ms: Date.now() - startedAt,
        version: VERSION,
      },
      500,
      corsHeaders
    );
  }
});

app.all("/*", (c) =>
  c.json(
    {
      ok: false,
      error: "Not found",
      routes: ["GET /health", "GET /tools", "POST /execute"],
      version: VERSION,
    },
    404,
    corsHeaders
  )
);

Deno.serve(app.fetch);
