
-- 0) Companies in scope (find “Bid List” and “Test”)
select id, name, default_project_track
from companies
where name ilike '%bid%' or name ilike '%test%'
order by name;

-- 1) Tracks grouped by company (so we can see where tracks actually live)
select 
  pt.id as track_id,
  pt.name as track_name,
  pt.company_id as track_company_id,
  c.name as track_company_name
from project_tracks pt
join companies c on c.id = pt.company_id
where c.name ilike '%bid%' or c.name ilike '%test%'
order by c.name, pt.name;

-- 2) Bid List projects and the company of their referenced track
-- Replace the subselect with the exact Bid List company UUID if you already know it
select 
  p.id as project_id,
  p.crm_id,
  p.created_at,
  p.company_id as project_company_id,
  c.name        as project_company_name,
  p.project_track,
  pt.name       as track_name,
  pt.company_id as track_company_id,
  c2.name       as track_company_name
from projects p
join companies c on c.id = p.company_id
left join project_tracks pt on pt.id = p.project_track
left join companies c2 on c2.id = pt.company_id
where p.company_id in (select id from companies where name ilike '%bid%')
order by p.created_at desc nulls last
limit 200;

-- 3a) Bid List projects with dangling project_track (ID set but no track row exists)
select 
  p.id as project_id,
  p.crm_id,
  p.project_track
from projects p
left join project_tracks pt on pt.id = p.project_track
where p.company_id in (select id from companies where name ilike '%bid%')
  and p.project_track is not null
  and pt.id is null
order by p.created_at desc nulls last
limit 200;

-- 3b) Bid List projects with NULL project_track
select count(*) as bid_list_projects_with_null_track
from projects p
where p.company_id in (select id from companies where name ilike '%bid%')
  and p.project_track is null;

-- 4) Sanity check: profiles currently associated with Bid List (verifies your user’s company switch)
select 
  id as profile_id,
  profile_fname,
  profile_lname,
  company_id
from profiles
where company_id in (select id from companies where name ilike '%bid%')
order by profile_lname nulls last, profile_fname nulls last
limit 200;
