
/**
 * Functions for handling project data
 */
export async function getExistingProject(supabase: any, crmId: string) {
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id,
      crm_id,
      summary,
      project_track
    `)
    .eq('crm_id', crmId)
    .limit(1)

  if (error) {
    console.error('Error fetching project:', error)
  }

  return projects && projects.length > 0 ? projects[0] : null
}

export async function getMilestoneInstructions(supabase: any, nextStep: string, projectTrackId: string | null) {
  if (!nextStep || !projectTrackId) {
    return null
  }

  const { data: milestone, error } = await supabase
    .from('project_track_milestones')
    .select('instructions')
    .eq('project_track_id', projectTrackId)
    .eq('name', nextStep)
    .single()

  if (error && error.status !== 404) {
    console.error('Error fetching milestone instructions:', error)
    return null
  }

  return milestone ? milestone.instructions : null
}

export async function updateProject(
  supabase: any,
  projectId: string,
  data: {
    summary: string;
    next_step: string;
    last_action_check: string;
    company_id: string;
    project_track?: string | null;
    next_check_date?: string | null;
  }
) {
  const { error } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)

  if (error) {
    console.error('Error updating project:', error)
    throw new Error('Failed to update project')
  }
}

export async function createProject(
  supabase: any,
  data: {
    summary: string;
    next_step: string;
    last_action_check: string;
    company_id: string;
    crm_id: string;
    project_track?: string | null;
    next_check_date?: string | null;
  }
) {
  const { error } = await supabase
    .from('projects')
    .insert(data)
    .select()

  if (error) {
    console.error('Error creating project:', error)
    throw new Error('Failed to create project')
  }
}

export async function setNextCheckDate(
  supabase: any,
  projectId: string,
  nextCheckDate: string | null
) {
  if (!projectId) {
    console.warn('Project ID is undefined, cannot set next check date.')
    return
  }

  const { error } = await supabase
    .from('projects')
    .update({ next_check_date: nextCheckDate })
    .eq('id', projectId)

  if (error) {
    console.error('Error setting next check date:', error)
    throw new Error('Failed to set next check date')
  } else {
    console.log('Set next check date to:', nextCheckDate)
  }
}
