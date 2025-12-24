-- Update get_contact_projects to also return projects where the contact's associated profile is the project manager
CREATE OR REPLACE FUNCTION public.get_contact_projects(contact_id uuid)
RETURNS TABLE(id uuid, project_name text, address text, company_id uuid, project_status text, summary text, next_step text)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  -- Projects linked via project_contacts
  SELECT 
    p.id,
    p.project_name,
    p."Address" as address,
    p.company_id,
    p."Project_status"::text as project_status,
    p.summary,
    p.next_step
  FROM public.projects p
  JOIN public.project_contacts pc ON p.id = pc.project_id
  WHERE pc.contact_id = $1
  
  UNION
  
  -- Projects where the contact's associated profile is the project manager
  SELECT 
    p.id,
    p.project_name,
    p."Address" as address,
    p.company_id,
    p."Project_status"::text as project_status,
    p.summary,
    p.next_step
  FROM public.projects p
  JOIN public.contacts c ON c.associated_profile = p.project_manager
  WHERE c.id = $1
    AND c.associated_profile IS NOT NULL;
$$;