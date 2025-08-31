
-- 1) Resolve target TPO track for the specified company
WITH target_track AS (
  SELECT id
  FROM public.project_tracks
  WHERE name = 'TPO test track'
    AND company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
  ORDER BY created_at DESC
  LIMIT 1
)

-- 2) Update the 20 test projects to the target company and align their track
UPDATE public.projects p
SET
  company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40',
  project_track = COALESCE((SELECT id FROM target_track), p.project_track)
WHERE p.project_name IN (
  'Happy Path Deal',
  'M2 funding outstanding',
  'M2 Statement missing',
  'M2 Rejected',
  'M2 Resubmitted',
  'Monitoring Missing',
  'M1 Funding missing',
  'Inservice form missing',
  'M1 Cert Missing',
  'M1 Rejected',
  'M1 Resubmitted',
  'COR/PIcture Missing',
  'Packing Slip Missing',
  'Equipment Invoice Missing',
  'NTP Fund Missing',
  'SOW Missing',
  'NTP Rejected',
  'NTP Resubmitted',
  'UB Missing',
  'NEM Missing'
);

-- 3) Verify results
SELECT project_name, company_id, project_track
FROM public.projects
WHERE project_name IN (
  'Happy Path Deal',
  'M2 funding outstanding',
  'M2 Statement missing',
  'M2 Rejected',
  'M2 Resubmitted',
  'Monitoring Missing',
  'M1 Funding missing',
  'Inservice form missing',
  'M1 Cert Missing',
  'M1 Rejected',
  'M1 Resubmitted',
  'COR/PIcture Missing',
  'Packing Slip Missing',
  'Equipment Invoice Missing',
  'NTP Fund Missing',
  'SOW Missing',
  'NTP Rejected',
  'NTP Resubmitted',
  'UB Missing',
  'NEM Missing'
)
ORDER BY project_name;
