
-- Fix the find_or_create_chat_session function implementation
CREATE OR REPLACE FUNCTION public.find_or_create_chat_session(
  p_channel_type TEXT,
  p_channel_identifier TEXT,
  p_company_id UUID,
  p_contact_id UUID DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_memory_mode TEXT DEFAULT 'standard'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id UUID;
  expiry_interval INTERVAL;
BEGIN
  -- Set expiry based on channel type
  IF p_channel_type = 'email' THEN
    expiry_interval := INTERVAL '7 days';
  ELSIF p_channel_type = 'web' THEN
    expiry_interval := INTERVAL '1 hour';
  ELSE
    expiry_interval := INTERVAL '24 hours';
  END IF;

  -- First try to find an active session
  SELECT id INTO session_id
  FROM chat_sessions
  WHERE 
    channel_type = p_channel_type AND
    channel_identifier = p_channel_identifier AND
    company_id = p_company_id AND
    active = TRUE AND
    expires_at > NOW()
  ORDER BY last_activity DESC
  LIMIT 1;
  
  -- If found, update last_activity and return
  IF FOUND THEN
    UPDATE chat_sessions
    SET last_activity = NOW()
    WHERE id = session_id;
    
    RETURN session_id;
  END IF;
  
  -- No session found, create a new one
  INSERT INTO chat_sessions (
    channel_type,
    channel_identifier,
    contact_id,
    company_id,
    project_id,
    memory_mode,
    expires_at
  ) VALUES (
    p_channel_type,
    p_channel_identifier,
    p_contact_id,
    p_company_id,
    p_project_id,
    p_memory_mode,
    NOW() + expiry_interval
  )
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;
