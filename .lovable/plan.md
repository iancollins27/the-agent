

# Backfill `company_id` on Roofer Contacts

## Current State

- **64 unique Roofer contacts**, all with `company_id = NULL`
- **All 64** are linked to projects via `project_contacts`
- Those projects all belong to **one company: BidList** (`45c8ff67-577b-41e4-bcf3-6f5da2880b40`)
- **0 Roofer contacts** are orphaned (no project link)
- Some roofers are linked to multiple projects, but all projects resolve to BidList (298 total project-contact links across the 64 roofers)

## Plan

Since every Roofer contact is linked to BidList projects, this is a single UPDATE statement:

**Step 1: Run a data update** to set `company_id` on all Roofer contacts by deriving the company from their linked projects.

```sql
UPDATE contacts c
SET company_id = sub.derived_company_id
FROM (
  SELECT DISTINCT c2.id as contact_id, p.company_id as derived_company_id
  FROM contacts c2
  JOIN project_contacts pc ON pc.contact_id = c2.id
  JOIN projects p ON p.id = pc.project_id
  WHERE c2.role::text = 'Roofer'
    AND c2.company_id IS NULL
) sub
WHERE c.id = sub.contact_id;
```

This uses the project relationship as the source of truth -- each roofer gets the `company_id` of the project(s) they're associated with. In this case they all resolve to BidList, so all 64 will get set to `45c8ff67-577b-41e4-bcf3-6f5da2880b40`.

No schema changes needed. No code changes needed. Just a one-time data backfill via the insert/update tool.

