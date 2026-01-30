

## Fix: MCP Server Tool Registration - Schema Format Mismatch

### Problem Identified
The error `{"error":"Internal server error","details":"Cannot read properties of undefined (reading 'inputSchema')"}` occurs because:

1. The current tool definitions in `TOOL_DEFINITIONS` use **plain JSON Schema objects**
2. The `mcp-lite` library's `.tool()` method expects **Zod schemas** (or other Standard Schema libraries)
3. When `mcp-lite` tries to convert the schema, it fails because it doesn't know how to handle raw JSON Schema

### Root Cause
In `supabase/functions/mcp-tools-server/index.ts`, line 69-72:
```typescript
mcpServer.tool({
  name: def.name,
  description: def.description,
  inputSchema: def.schema,  // This is a JSON Schema object, not a Zod schema
  handler: async (args) => {...}
});
```

### Solution Options

**Option A: Convert TOOL_DEFINITIONS to use Zod schemas** (Recommended)
- More idiomatic for `mcp-lite`
- Provides runtime validation and type inference
- Requires importing Zod in the edge function

**Option B: Use mcp-lite's low-level API with JSON Schema**
- Register tools using the raw JSON-RPC method handler
- More complex but keeps existing JSON Schema definitions

I recommend **Option A** as it aligns with how `mcp-lite` is designed to work.

### Implementation Plan

| Step | File | Change |
|------|------|--------|
| 1 | `supabase/functions/mcp-tools-server/schemas.ts` | Create Zod schemas for each tool, mirroring the existing JSON Schema definitions |
| 2 | `supabase/functions/mcp-tools-server/index.ts` | Update tool registration to use Zod schemas and add `schemaAdapter` to McpServer |
| 3 | `supabase/functions/mcp-tools-server/deno.json` | Add Zod import |

### Detailed Changes

**1. Create `schemas.ts` with Zod schemas:**
```typescript
import { z } from "npm:zod@3.23.8";

export const CrmReadSchema = z.object({
  resource_type: z.enum(['project', 'contact', 'activity', 'note']),
  project_id: z.string().optional(),
  crm_id: z.string().optional(),
  limit: z.number().optional()
});

export const CrmWriteSchema = z.object({
  project_id: z.string(),
  resource_type: z.enum(['project', 'task', 'note', 'contact']),
  operation_type: z.enum(['create', 'update', 'delete']),
  resource_id: z.string().optional(),
  data: z.record(z.unknown()),
  requires_approval: z.boolean().optional()
});

// ... other tool schemas
```

**2. Update `index.ts` to use Zod schemas:**
```typescript
import { z } from "npm:zod@3.23.8";
import { CrmReadSchema, CrmWriteSchema, ... } from "./schemas.ts";

const mcpServer = new McpServer({
  name: "external-tools-server",
  version: "1.0.0",
  schemaAdapter: (schema) => {
    // Convert Zod schema to JSON Schema for MCP protocol
    if (schema && typeof schema === 'object' && '_def' in schema) {
      return z.toJSONSchema(schema as z.ZodType);
    }
    return schema;
  },
});

// Map tool names to Zod schemas
const TOOL_SCHEMAS = {
  crm_read: CrmReadSchema,
  crm_write: CrmWriteSchema,
  // ...
};

// Register tools with Zod schemas
for (const toolName of authResult.enabledTools || []) {
  const def = TOOL_DEFINITIONS[toolName];
  const schema = TOOL_SCHEMAS[toolName];
  
  if (!def || !schema) continue;

  mcpServer.tool(def.name, {
    description: def.description,
    inputSchema: schema,
    handler: async (args) => {
      // ... existing handler logic
    }
  });
}
```

**3. Update `deno.json` imports:**
```json
{
  "imports": {
    "hono": "jsr:@hono/hono",
    "mcp-lite": "npm:mcp-lite@^0.10.0",
    "zod": "npm:zod@3.23.8"
  }
}
```

### Technical Notes

- Zod schemas provide automatic TypeScript type inference for the handler's `args` parameter
- The `schemaAdapter` converts Zod schemas to JSON Schema format for the MCP protocol wire format
- This approach maintains compatibility with the existing `TOOL_DEFINITIONS` structure (used elsewhere) while adding proper schema handling for `mcp-lite`
- The Claude Agent SDK will now be able to discover tools correctly during the `initialize` handshake

