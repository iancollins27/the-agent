-- Update next_step values for specific projects based on project names
UPDATE projects 
SET next_step = CASE 
  WHEN project_name = 'Happy Path Deal' THEN NULL
  WHEN project_name = 'M2 funding outstanding' THEN 'M2'
  WHEN project_name = 'M2 Statement missing' THEN 'M2'
  WHEN project_name = 'M2 Rejected' THEN 'M2'
  WHEN project_name = 'M2 Resubmitted' THEN 'M2'
  WHEN project_name = 'Monitoring Missing' THEN 'M2'
  WHEN project_name = 'M1 Funding missing' THEN 'M1'
  WHEN project_name = 'Inservice form missing' THEN 'M1'
  WHEN project_name = 'M1 Cert Missing' THEN 'M1'
  WHEN project_name = 'M1 Rejected' THEN 'M1'
  WHEN project_name = 'M1 Resubmitted' THEN 'M1'
  WHEN project_name = 'COR/PIcture Missing' THEN 'M1'
  WHEN project_name = 'Packing Slip Missing' THEN 'M1'
  WHEN project_name = 'Equipment Invoice Missing' THEN 'M1'
  WHEN project_name = 'NTP Fund Missing' THEN 'NTP'
  WHEN project_name = 'SOW Missing' THEN 'NTP'
  WHEN project_name = 'NTP Rejected' THEN 'NTP'
  WHEN project_name = 'NTP Resubmitted' THEN 'NTP'
  WHEN project_name = 'UB Missing' THEN 'NTP'
  WHEN project_name = 'NEM Missing' THEN 'NTP'
  ELSE next_step
END
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