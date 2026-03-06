

## Centralize AI Model Configuration

### Problem

The AI model name is hardcoded in **19+ locations** across **11 edge function directories**, with two different values:
- `gpt-5-2025-08-07` in 11 files (the "current" model)
- `gpt-4o` still lingering as defaults in 8 files (stale/inconsistent)

Every model change requires editing 10+ files and risks missing some, leading to inconsistency.

### Solution

Create a single shared config file that all edge functions import from, and replace every hardcoded model string with a reference to that config.

### Implementation

**1. Create shared AI config: `supabase/functions/_shared/aiConfig.ts`**

```typescript
// Central AI model configuration
// Change the model here and it applies everywhere
export const AI_CONFIG = {
  provider: 'openai',
  model: Deno.env.get('AI_MODEL') || 'gpt-5-nano-2025-08-07',
  apiKeyEnvVar: 'OPENAI_API_KEY',
} as const;

export const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  'gpt-5-2025-08-07': { prompt: 0.03, completion: 0.06 },
  'gpt-5-mini-2025-08-07': { prompt: 0.01, completion: 0.03 },
  'gpt-5-nano-2025-08-07': { prompt: 0.005, completion: 0.015 },
  'gpt-4o': { prompt: 0.03, completion: 0.06 },
  'gpt-4o-mini': { prompt: 0.01, completion: 0.03 },
};
```

This uses an environment variable `AI_MODEL` with a fallback default, so you can switch models via Supabase secrets without any code changes at all.

**2. Update all edge functions to import from shared config**

Replace every hardcoded model string with `AI_CONFIG.model`. Files to update:

| File | Current hardcoded value | Change |
|------|------------------------|--------|
| `agent-chat/index.ts` | `'gpt-5-2025-08-07'` (8 occurrences) | Import and use `AI_CONFIG.model` |
| `agent-chat/observability.ts` | `'gpt-5-2025-08-07'` fallback | Use `AI_CONFIG.model` as default rate |
| `process-zoho-webhook/handlers/aiConfigHandler.ts` | `'gpt-5-2025-08-07'` | Import from shared config |
| `process-zoho-webhook/ai.ts` | `'gpt-5-2025-08-07'` and `'gpt-4o'` defaults | Import from shared config |
| `process-zoho-webhook/handlers/webhookHandler.ts` | `'gpt-4o'` fallback | Import from shared config |
| `comms-business-logic/services/multiProjectUpdater.ts` | `'gpt-5-2025-08-07'` | Import from shared config |
| `comms-business-logic/services/multiProjectProcessor.ts` | `'gpt-5-2025-08-07'` | Import from shared config |
| `check-project-reminders/index.ts` | `'gpt-5-2025-08-07'` | Import from shared config |
| `email-summary/index.ts` | `'gpt-5-2025-08-07'` | Import from shared config |
| `generate-multi-project-message/index.ts` | `'gpt-5-2025-08-07'` | Import from shared config |
| `test-workflow-prompt/ai-providers.ts` | Cost table + `'gpt-4o'` | Use shared `MODEL_COSTS` |
| `test-workflow-prompt/middleware/promptRunner.ts` | `'gpt-4o'` default | Import from shared config |
| `test-workflow-prompt/services/mcpService.ts` | `'gpt-4o'` default | Import from shared config |
| `test-workflow-prompt/services/providers/openai/costCalculator.ts` | Multiple models in switch | Use shared `MODEL_COSTS` |

**3. Also fix stale `gpt-4o` references**

Several files still default to `gpt-4o` which is inconsistent with the decision to standardize on GPT-5. These will all point to `AI_CONFIG.model` after the change.

**4. Redeploy all affected edge functions**

### Benefits

- **One-line model changes**: Edit the default in `_shared/aiConfig.ts` or set the `AI_MODEL` env var
- **No code deploys needed for model switches**: If using the env var, just update the Supabase secret
- **Eliminates inconsistency**: No more stale `gpt-4o` defaults mixed with `gpt-5` references
- **Cost tables centralized**: One source of truth for pricing data

### Technical Notes

- The `_shared` directory is already used by the project for shared edge function code
- The env var approach (`AI_MODEL`) means future model changes can be done entirely through Supabase dashboard secrets, with no code change or redeployment needed
- The hardcoded fallback (`gpt-5-nano-2025-08-07`) ensures the system works even without the env var set
- Cost calculation tables will also be centralized so pricing stays in sync

