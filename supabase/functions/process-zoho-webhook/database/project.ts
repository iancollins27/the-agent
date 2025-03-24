
/**
 * Finds an existing project by CRM ID
 * @param supabase Supabase client
 * @param crmId CRM ID of the project
 * @returns Project object if found, null otherwise
 */
export async function getExistingProject(supabase: any, crmId: string) {
  console.log('Looking for project with CRM ID:', crmId);
  
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

  console.log('Found projects:', projects ? projects.length : 0);
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
    project_manager?: string | null; // Added project_manager field
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
    project_manager?: string | null; // Added project_manager field
  }
) {
  console.log('Creating new project with CRM ID:', data.crm_id);
  
  const { error } = await supabase
    .from('projects')
    .insert(data)
    .select()

  if (error) {
    console.error('Error creating project:', error)
    throw new Error('Failed to create project')
  }
}

/**
 * Find a profile by CRM ID
 * @param supabase Supabase client
 * @param crmId CRM ID to search for
 * @returns Profile ID if found, null otherwise
 */
export async function findProfileByCrmId(supabase: any, crmId: string) {
  if (!crmId) {
    console.log('No CRM ID provided to search for profile')
    return null
  }

  console.log('Searching for profile with CRM ID:', crmId)
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('profile_crm_id', crmId)
    .limit(1)

  if (error) {
    console.error('Error finding profile by CRM ID:', error)
    return null
  }

  if (profiles && profiles.length > 0) {
    console.log('Found profile with ID:', profiles[0].id)
    return profiles[0].id
  }
  
  console.log('No profile found with CRM ID:', crmId)
  return null
}
