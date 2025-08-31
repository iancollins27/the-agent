-- Update test projects to use TPO test track
UPDATE projects 
SET project_track = (
  SELECT id 
  FROM project_tracks 
  WHERE name = 'TPO test track' 
  LIMIT 1
)
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
);