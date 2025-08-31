
-- Check if BidList has any projects at all
SELECT COUNT(*) as bidlist_project_count
FROM projects 
WHERE company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40';

-- Check if testy has any project tracks
SELECT COUNT(*) as testy_track_count
FROM project_tracks 
WHERE company_id = '66c49815-f19e-4075-85f2-fabcd81d9988';

-- Check what the current default_project_track values are for both companies
SELECT 
  c.name as company_name,
  c.default_project_track,
  CASE 
    WHEN c.default_project_track IS NULL THEN 'NULL'
    WHEN pt.id IS NULL THEN 'DANGLING (track does not exist)'
    WHEN pt.company_id != c.id THEN 'CROSS-COMPANY REFERENCE'
    ELSE 'OK'
  END as status
FROM companies c
LEFT JOIN project_tracks pt ON pt.id = c.default_project_track
WHERE c.id IN (
  '45c8ff67-577b-41e4-bcf3-6f5da2880b40', -- BidList
  '66c49815-f19e-4075-85f2-fabcd81d9988'  -- testy
);

-- Show all project tracks regardless of company to understand the current state
SELECT 
  pt.id,
  pt.name,
  pt.company_id,
  c.name as company_name
FROM project_tracks pt
LEFT JOIN companies c ON c.id = pt.company_id
ORDER BY c.name, pt.name;
