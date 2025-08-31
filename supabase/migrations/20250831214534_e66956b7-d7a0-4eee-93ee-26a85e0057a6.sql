
-- Preview: show counts of projects that currently use the two known tracks (regardless of company)
select 
  p.company_id,
  p.project_track,
  count(*) as project_count
from projects p
where p.project_track in (
  '0519c61e-6df0-4151-91e3-e4eab3fe2b4c', -- TPO test track (current source company)
  '8c88e7bc-6263-47ca-8984-6cc05d4e9dc3'  -- solar x roof marketplace standard (current source company)
)
group by p.company_id, p.project_track
order by project_count desc;

-- 1) Ensure the two tracks exist in the TARGET company (45c8ff67-577b-41e4-bcf3-6f5da2880b40)
-- TPO test track
with upsert_tpo as (
  insert into project_tracks (company_id, name)
  select '45c8ff67-577b-41e4-bcf3-6f5da2880b40', 'TPO test track'
  where not exists (
    select 1 from project_tracks 
    where company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40' 
      and name = 'TPO test track'
  )
  returning id
),
tpo as (
  select id from upsert_tpo
  union all
  select id from project_tracks 
  where company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40' 
    and name = 'TPO test track'
),

-- solar x roof marketplace standard
upsert_std as (
  insert into project_tracks (company_id, name)
  select '45c8ff67-577b-41e4-bcf3-6f5da2880b40', 'solar x roof marketplace standard'
  where not exists (
    select 1 from project_tracks 
    where company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40' 
      and name = 'solar x roof marketplace standard'
  )
  returning id
),
std as (
  select id from upsert_std
  union all
  select id from project_tracks 
  where company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40' 
    and name = 'solar x roof marketplace standard'
),

-- 2) Move projects to target company and remap their track to the target company's track IDs
moved as (
  update projects p
  set company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40',
      project_track = case 
        when p.project_track = '0519c61e-6df0-4151-91e3-e4eab3fe2b4c' 
          then (select id from tpo)
        when p.project_track = '8c88e7bc-6263-47ca-8984-6cc05d4e9dc3' 
          then (select id from std)
        else p.project_track
      end
  where p.project_track in (
    '0519c61e-6df0-4151-91e3-e4eab3fe2b4c',
    '8c88e7bc-6263-47ca-8984-6cc05d4e9dc3'
  )
  returning p.id
)
-- 3) Show how many rows were updated
select count(*) as updated_projects_count from moved;

-- 4) Verify after: counts by company/track in target company
select 
  p.company_id,
  pt.name as track_name,
  count(*) as project_count
from projects p
left join project_tracks pt on pt.id = p.project_track
where p.company_id = '45c8ff67-577b-41e4-bcf3-6f5da2880b40'
group by p.company_id, pt.name
order by project_count desc;
