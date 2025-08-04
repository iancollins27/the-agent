-- Add UPDATE policy for prompt_runs to allow users to update feedback-related columns
CREATE POLICY "Users can update feedback for their company's prompt runs" 
ON public.prompt_runs 
FOR UPDATE 
USING (EXISTS ( 
  SELECT 1
  FROM (projects p
    JOIN profiles prof ON (prof.company_id = p.company_id))
  WHERE (p.id = prompt_runs.project_id) AND (prof.id = auth.uid())
));