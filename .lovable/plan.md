

## Plan: Fix TypeScript Build Errors and Redeploy MCP Server

### Overview

This plan fixes TypeScript build errors in 3 edge functions while preserving all existing functionality. The errors are primarily type safety issues (`error` is of type `unknown`, implicit `any` types, and missing type annotations). The MCP server will also be redeployed to ensure v2.3.0 with the Cursor changes (two-argument signature) is live.

### Files to Modify

| File | Error Count | Issue Types |
|------|-------------|-------------|
| `supabase/functions/comms-webhook-twilio/index.ts` | 6 | `unknown` error type, implicit `any`, missing property types |
| `supabase/functions/chat-webhook-twilio/index.ts` | 21+ | `unknown` error type, implicit `any`, `null` assignment issues |
| `supabase/functions/agent-chat/mcp-context-manager.ts` | 9 | `unknown` error type, `content: null`, `tool_call_id` property |
| `supabase/functions/agent-chat/mcp.ts` | 6+ | `unknown` error type, implicit `any` |
| `supabase/functions/agent-chat/context/mcp-context-manager.ts` | 2 | `projectData?.id` access on wrong type |

### Changes Summary

All changes are type annotations or safe type casts only - no logic changes.

---

### 1. `comms-webhook-twilio/index.ts`

**Error 1-2**: `requestBody[key] = value` - object has no index signature

```typescript
// Line 23: Change from
let requestBody = {};
// To
let requestBody: Record<string, unknown> = {};
```

**Error 3-5**: `requestBody.CallSid`, `MessageSid`, `SmsSid` do not exist

```typescript
// Line 66: Cast to access properties
webhook_id: (requestBody as Record<string, unknown>).CallSid || 
            (requestBody as Record<string, unknown>).MessageSid || 
            (requestBody as Record<string, unknown>).SmsSid,
```

**Error 6**: `error` is of type `unknown`

```typescript
// Line 122: Change from
JSON.stringify({ error: error.message }),
// To
JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
```

---

### 2. `chat-webhook-twilio/index.ts`

**Error at lines 113-114, 151**: `parseError` is of type `unknown`

```typescript
// Lines 113-114: Change from
console.error(`Error parsing Twilio response: ${parseError.message}`);
throw new Error(`Twilio API response parsing error: ${parseError.message}`);
// To
console.error(`Error parsing Twilio response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
throw new Error(`Twilio API response parsing error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
```

**Error at lines 280, 320**: `c` implicitly has `any` type

```typescript
// Line 280: Add type annotation
const preferred = existingContacts.find((c: any) => c.phone_number === normalizedPhone) || existingContacts[0];

// Line 320: Add type annotation
const preferred = retryContacts.find((c: any) => c.phone_number === normalizedPhone) || retryContacts[0];
```

**Error at line 438**: `null` not assignable to `string | undefined`

```typescript
// Line 438: Change null to undefined
undefined  // instead of null
```

**Error at line 466**: `projectId` does not exist on type

```typescript
// Line 466: Add type cast and handle optional
const { contact, companyId, projectId } = contactAndCompany as { contact: any; companyId: any; projectId?: any };
```

**Error at lines 678, 681, 682, 719**: `c` implicitly has `any` type

```typescript
// Add (c: any) annotations to all filter/map callbacks
```

**Error at line 745**: Cannot find name `createCompanySelectionSession`

This appears to be a missing function - need to check if it exists elsewhere or needs to be defined (will investigate if referenced).

**Error at lines 791, 803**: `pd` implicitly has `any` type

```typescript
// Add (pd: any) annotations
```

**Error at lines 820-827**: `projectCompany` is of type `unknown`

```typescript
// Cast uniqueProjectCompanies to proper type or use type assertion
```

**Error at line 1115**: `error` is of type `unknown`

```typescript
// Use: error instanceof Error ? error.message : String(error)
```

---

### 3. `agent-chat/mcp-context-manager.ts`

**Error at lines 133-134**: `toolError` is of type `unknown`

```typescript
// Lines 133-134: Already fixed in context/tool-processor.ts but not in root mcp-context-manager.ts
error: toolError instanceof Error ? toolError.message : "Unknown tool execution error",
message: `Tool execution failed: ${toolError instanceof Error ? toolError.message : "Unknown error"}`
```

**Error at line 140**: `content: null` not assignable to `string`

```typescript
// Change from
content: null,
// To
content: '',
```

**Error at line 156**: `tool_call_id` does not exist on type

```typescript
// Use type assertion
this.messages.push({
  role: 'tool',
  tool_call_id: call.id,
  content: JSON.stringify(errorResult)
} as any);
```

**Error at lines 72, 169, 181, 237, 266**: `projectData?.id` - `id` does not exist on type `never`

```typescript
// This is a type inference issue - projectData is initialized as null but then conditionally assigned
// Fix by properly typing projectData
let projectData: { id: string; [key: string]: any } | null = null;
```

---

### 4. `agent-chat/mcp.ts`

**Error at lines 39, 62**: `error` is of type `unknown`

```typescript
// Use: error instanceof Error ? error.message : String(error)
```

**Error at lines 81, 84, 90, 110+**: `m`, `tc` implicitly have `any` type

```typescript
// Add type annotations: (m: any), (tc: any)
```

---

### 5. `agent-chat/context/mcp-context-manager.ts`

**Error at line 72**: `projectData?.id` on wrong type

```typescript
// The projectData variable is typed through the processActionData call
// Need to update the condition to handle the typing properly
```

---

### Deployment Steps

1. Fix all TypeScript errors in the files listed above
2. Ensure the build passes without errors
3. The edge functions will auto-deploy with the next build
4. Verify `mcp-tools-server` shows v2.3.0 at `/health` endpoint

### Preservation Notes

- The `mcp-tools-server/index.ts` changes from Cursor (two-argument signature) are already in place and will not be modified
- All fixes are type annotations only - no logic changes
- Function behavior remains identical

### Technical Details

The fixes follow TypeScript best practices:
- Using `instanceof Error` checks for proper error handling
- Using `Record<string, unknown>` for dynamic object types
- Using `as any` type assertions only where necessary for external library compatibility
- Using explicit type annotations for callback parameters

