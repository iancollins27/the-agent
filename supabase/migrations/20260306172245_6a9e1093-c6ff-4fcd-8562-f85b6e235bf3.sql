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