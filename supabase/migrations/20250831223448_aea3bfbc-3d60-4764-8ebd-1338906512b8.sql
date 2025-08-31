
-- 0) Confirm both companies and which default tracks they point to
SELECT 
  c.id, 
  c.name, 
  c.default_project_track,
  pt.name AS default_track_name,
  pt.company_id AS default_track_company_id,
  c2.name AS default_track_company_name
FROM companies c
LEFT JOIN project_tracks pt ON pt.id = c.default_project_track
LEFT JOIN companies c2 ON c2.id = pt.company_id
WHERE c.id IN (
  '45c8ff67-577b-41e4-bcf3-6f5da2880b40', -- BidList
  '66c49815-f19e-4075-85f2-fabcd81d9988'  -- testy
)
ORDER BY c.name;

-- 1) List all tracks under BidList and testy
SELECT 
  pt.id AS track_id,
  pt.name AS track_name,
  pt.company_id,
  c.name AS company_name
FROM project_tracks pt
JOIN companies c ON c.id = pt.company_id
WHERE c.id IN (
  '45c8ff67-577b-41e4-bcf3-6f5da2880b40', -- BidList
  '66c49815-f19e-4075-85f2-fabcd81d9988'  -- testy
)
ORDER BY c.name, pt.name;

-- 2) For BidList projects, show the track they point to and the company that owns that track
SELECT 
  p.id AS project_id,
  p.project_name,
  p.company_id AS project_company_id,
  pc.name      AS project_company_name,
  p.project_track,
  pt.name      AS track_name,
  pt.company_id AS track_company_id,
  tc.name       AS track_company_name
FROM projects p
JOIN companies pc ON pc.id = p.company_id
LEFT JOIN project_tracks pt ON pt.id = p.project_track
LEFT JOIN companies tc ON tc.id = pt.company_id
WHERE p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40' -- BidList
ORDER BY p.created_at DESC NULLS LAST
LIMIT 200;

-- 3) Quick counts for BidList projects by track status
SELECT 
  COUNT(*) FILTER (WHERE p.project_track IS NULL)                             AS null_track,
  COUNT(*) FILTER (WHERE p.project_track IS NOT NULL AND pt.id IS NULL)       AS dangling_track_id,
  COUNT(*) FILTER (WHERE pt.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40') AS correct_company_track,
  COUNT(*) FILTER (WHERE pt.company_id = '66c49815-f19e-4075-85f2-fabcd81d9988') AS cross_company_track
FROM projects p
LEFT JOIN project_tracks pt ON pt.id = p.project_track
WHERE p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'; -- BidList
