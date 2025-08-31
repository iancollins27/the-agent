
-- 0) QUICK CONTEXT: confirm company + default track wiring
select 
  c.id as company_id,
  c.name as company_name,
  c.default_project_track,
  pt.name as default_project_track_name
from companies c
left join project_tracks pt on pt.id = c.default_project_track
where c.id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40';

-- 1) LIST TRACKS under the target company with usage counts
select
  pt.id,
  pt.name,
  pt."Roles",
  pt."track base prompt",
  count(p.id) as projects_using
from project_tracks pt
left join projects p on p.project_track = pt.id
where pt.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
group by pt.id, pt.name, pt."Roles", pt."track base prompt"
order by pt.name;

-- 2) PROJECTS IN TARGET COMPANY that point to a track in a DIFFERENT company (mismatch)
select
  p.id as project_id,
  p.crm_id,
  p."Address",
  p.company_id as project_company,
  p.project_track,
  pt.company_id as track_company,
  pt.name as track_name
from projects p
join project_tracks pt on pt.id = p.project_track
where p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
  and pt.company_id <> p.company_id
order by p.created_at desc nulls last;

-- 3) PROJECTS IN TARGET COMPANY with project_track pointing to a NON-EXISTENT track (dangling ref) or NULL
-- 3a) Dangling: project_track set but no matching track record
select
  p.id as project_id,
  p.crm_id,
  p."Address",
  p.company_id as project_company,
  p.project_track
from projects p
left join project_tracks pt on pt.id = p.project_track
where p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
  and p.project_track is not null
  and pt.id is null
order by p.created_at desc nulls last;

-- 3b) Null project_track
select
  count(*) as projects_with_null_track
from projects p
where p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
  and p.project_track is null;

-- 4) USAGE OVERVIEW: For all companies, how many tracks and projects per company (sanity check)
--    Helps detect if tracks accidentally live in another company.
with tracks_per_company as (
  select company_id, count(*) as track_count
  from project_tracks
  group by company_id
),
projects_per_company as (
  select company_id, count(*) as project_count
  from projects
  group by company_id
)
select
  coalesce(t.company_id, p.company_id) as company_id,
  coalesce(t.track_count, 0) as track_count,
  coalesce(p.project_count, 0) as project_count
from tracks_per_company t
full outer join projects_per_company p on p.company_id = t.company_id
order by project_count desc;

-- 5) DUPLICATE TRACK NAMES across companies (can cause confusion when remapping)
select
  name,
  count(*) as occurrences,
  array_agg(jsonb_build_object('track_id', id, 'company_id', company_id) order by company_id) as track_ids_by_company
from project_tracks
group by name
having count(*) > 1
order by occurrences desc, name;

-- 6) WHICH TRACKS DO TARGET COMPANY PROJECTS ACTUALLY USE (by name), even if the track lives elsewhere
select
  pt.name as track_name_in_use,
  pt.company_id as track_company_id,
  count(*) as projects_using
from projects p
left join project_tracks pt on pt.id = p.project_track
where p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
group by pt.name, pt.company_id
order by projects_using desc nulls last;

-- 7) SAMPLE RECENT PROJECTS in target company with their track info (quick eyeball check)
select
  p.id as project_id,
  p.crm_id,
  p."Address",
  p.created_at,
  p.project_track,
  pt.name as track_name,
  pt.company_id as track_company
from projects p
left join project_tracks pt on pt.id = p.project_track
where p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
order by p.created_at desc
limit 50;

-- 8) RLS POLICY INTROSPECTION (ensure project_tracks select policy is as expected)
select
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  with_check
from pg_policies
where tablename in ('project_tracks','projects')
order by tablename, policyname;
