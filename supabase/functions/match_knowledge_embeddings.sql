
-- This file is kept for reference only. The actual function is defined in the database directly.

CREATE OR REPLACE FUNCTION search_projects_by_vector(
  search_embedding vector, 
  match_threshold double precision DEFAULT 0.2, 
  match_count integer DEFAULT 5,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, 
  crm_id text, 
  summary text, 
  next_step text, 
  company_id uuid, 
  company_name text, 
  address text, 
  status text, 
  similarity double precision,
  project_name text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.crm_id,
    p.summary,
    p.next_step,
    p.company_id,
    c.name as company_name,
    p."Address" as address,
    p."Project_status" as status,
    1 - (p.search_vector <=> search_embedding) AS similarity,
    p.project_name
  FROM
    projects p
  LEFT JOIN
    companies c ON p.company_id = c.id
  WHERE
    p.search_vector IS NOT NULL
    AND (p_company_id IS NULL OR p.company_id = p_company_id)
  ORDER BY
    p.search_vector <=> search_embedding
  LIMIT match_count;
END;
$$;
