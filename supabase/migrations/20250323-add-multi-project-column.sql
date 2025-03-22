
-- Add a column to mark communications as potentially relating to multiple projects
ALTER TABLE IF EXISTS public.communications 
ADD COLUMN IF NOT EXISTS multi_project_potential BOOLEAN DEFAULT false;

-- Create an index to speed up queries filtering by multi_project_potential
CREATE INDEX IF NOT EXISTS idx_communications_multi_project_potential 
ON public.communications(multi_project_potential);
