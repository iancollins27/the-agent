-- Fix vector search RPC return type mismatch:
-- projects."Project_status" is an enum, but the function returns it as text.
CREATE OR REPLACE FUNCTION public.search_projects_by_vector(
  search_embedding vector,
  match_threshold double precision DEFAULT 0.2,
  match_count integer DEFAULT 5,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  project_name text,
  "Address" text,
  crm_id text,
  summary text,
  next_step text,
  "Project_status" text,
  crm_status text,
  project_manager text,
  similarity double precision
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.project_name,
    p."Address",
    p.crm_id,
    p.summary,
    p.next_step,
    p."Project_status"::text,
    p.crm_status,
    p.project_manager,
    1 - (p.search_vector <=> search_embedding) AS similarity
  FROM public.projects p
  WHERE
    p.search_vector IS NOT NULL
    AND (p_company_id IS NULL OR p.company_id = p_company_id)
    AND (1 - (p.search_vector <=> search_embedding)) > match_threshold
  ORDER BY p.search_vector <=> search_embedding
  LIMIT match_count;
END;
$function$;
