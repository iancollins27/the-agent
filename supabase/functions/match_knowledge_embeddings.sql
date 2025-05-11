-- This file is kept for reference only. The actual function is defined in the database directly.

CREATE OR REPLACE FUNCTION search_projects_by_vector(
  search_embedding vector, 
  match_threshold double precision DEFAULT 0.2, 
  match_count integer DEFAULT 5,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE(
  address text,
  similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p."Address" as address,
    1 - (p.search_vector <=> search_embedding) AS similarity
  FROM
    projects p
  WHERE
    p.search_vector IS NOT NULL
    AND (p_company_id IS NULL OR p.company_id = p_company_id)
    AND (1 - (p.search_vector <=> search_embedding)) > match_threshold
  ORDER BY
    p.search_vector <=> search_embedding
  LIMIT match_count;
END;
$$;
