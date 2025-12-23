-- Step 1: Update the get_projects_due_for_check function to filter inactive projects
CREATE OR REPLACE FUNCTION public.get_projects_due_for_check()
 RETURNS SETOF projects
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.projects
  WHERE next_check_date IS NOT NULL
    AND next_check_date <= NOW()
    AND (
      "Project_status" IS NULL 
      OR "Project_status" NOT IN ('Archived')
    );
END;
$function$;

-- Step 2: Clear stale next_check_date for projects with dates older than 30 days ago
-- These are clearly not being updated properly and are causing unnecessary checks
UPDATE public.projects
SET next_check_date = NULL
WHERE next_check_date IS NOT NULL
  AND next_check_date < (NOW() - INTERVAL '30 days');