

## Fix: API Key Creation - Profile Query Bug

### Problem
The profile query in `createKeyMutation` doesn't filter by the current user's ID. Due to RLS policies that allow viewing all company profiles, the query returns multiple rows, causing `.single()` to fail.

### Solution
Add an explicit filter for the current user's ID before calling `.single()`.

### File to Modify

| File | Change |
|------|--------|
| `src/components/Settings/ExternalAccessSettings.tsx` | Fix the profile query to filter by `auth.uid()` |

### Code Change

**Before:**
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('company_id')
  .single();
```

**After:**
```typescript
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  throw new Error('Not authenticated');
}

const { data: profile } = await supabase
  .from('profiles')
  .select('company_id')
  .eq('id', user.id)
  .single();
```

This ensures we only fetch the current user's profile, which will return exactly one row.

