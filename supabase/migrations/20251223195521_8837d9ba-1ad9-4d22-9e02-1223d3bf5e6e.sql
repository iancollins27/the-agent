-- Step 1: Add missing CRM fields to projects table for activation criteria
-- These fields will be cached locally so we don't need to call agent-chat

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS "Contract_Signed" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "Roof_Install_Finalized" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "Test_Record" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "crm_status" TEXT;

-- Step 2: Update the get_projects_due_for_check function to pre-filter using activation criteria
-- This eliminates the need to call agent-chat to check if a project is active
CREATE OR REPLACE FUNCTION public.get_projects_due_for_check()
 RETURNS SETOF projects
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.projects
  WHERE 
    -- Time-based check: next_check_date must be set and in the past
    next_check_date IS NOT NULL
    AND next_check_date <= NOW()
    
    -- Entry criteria: Contract signed, roof install NOT finalized, not a test record
    AND "Contract_Signed" IS NOT NULL
    AND "Roof_Install_Finalized" IS NULL
    AND ("Test_Record" = false OR "Test_Record" IS NULL)
    
    -- Status criteria: Not archived or cancelled (check both crm_status and Project_status)
    AND (
      "Project_status" IS NULL 
      OR "Project_status" NOT IN ('Archived')
    )
    AND (
      crm_status IS NULL 
      OR crm_status NOT IN ('Archived', 'VOID', 'Cancelled', 'Canceled')
    );
END;
$function$;

-- Add index for faster queries on the activation criteria fields
CREATE INDEX IF NOT EXISTS idx_projects_activation_criteria 
ON public.projects (next_check_date, "Contract_Signed", "Roof_Install_Finalized", "Test_Record")
WHERE next_check_date IS NOT NULL;