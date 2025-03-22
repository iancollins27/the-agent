
-- This migration creates a table to track batched communications
CREATE TABLE IF NOT EXISTS public.comms_batch_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) NOT NULL,
  batch_status TEXT NOT NULL CHECK (batch_status IN ('in_progress', 'processing', 'completed', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  scheduled_processing_time TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Add batch_id column to communications table
ALTER TABLE public.communications ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.comms_batch_status(id);

-- Create index on project_id and batch_status for faster lookups
CREATE INDEX IF NOT EXISTS idx_comms_batch_status_project_batch ON public.comms_batch_status(project_id, batch_status);

-- Create index on communications batch_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_communications_batch_id ON public.communications(batch_id);
