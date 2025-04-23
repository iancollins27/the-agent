
-- Create function to count pending actions per prompt run
CREATE OR REPLACE FUNCTION count_pending_actions_per_run(run_ids uuid[])
RETURNS TABLE (prompt_run_id uuid, count bigint) 
LANGUAGE SQL
AS $$
  SELECT 
    prompt_run_id,
    COUNT(*) as count
  FROM action_records
  WHERE 
    prompt_run_id = ANY(run_ids)
    AND status = 'pending'
  GROUP BY prompt_run_id;
$$;
