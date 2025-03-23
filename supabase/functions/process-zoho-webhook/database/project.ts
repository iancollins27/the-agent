
/**
 * Finds an existing project by CRM ID
 * @param supabase Supabase client
 * @param crmId CRM ID of the project
 * @returns Project object if found, null otherwise
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

/**
 * Updates an existing project with new data
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param data Project data to update
 */
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
    Address?: string;
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

/**
 * Creates a new project
 * @param supabase Supabase client
 * @param data Project data to create
 */
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
    Address?: string;
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
