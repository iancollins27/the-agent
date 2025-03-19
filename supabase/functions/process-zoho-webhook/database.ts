import { ParsedProjectData } from './types.ts';

export async function handleCompany(supabase: any, projectData: ParsedProjectData, rawData: any) {
  // Check if the company already exists
  let { data: existingCompany, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .eq('zoho_id', projectData.zohoCompanyId)
    .single();

  if (companyError && companyError.status !== 404) {
    console.error('Error checking existing company:', companyError);
    throw new Error('Failed to check existing company');
  }

  if (!existingCompany) {
    // If the company doesn't exist, create it
    const companyName = rawData?.Company_Name || rawData?.rawData?.Company_Name || 'Unknown Company';
    let { data: newCompany, error: newCompanyError } = await supabase
      .from('companies')
      .insert({ zoho_id: projectData.zohoCompanyId, name: companyName })
      .select('*')
      .single();

    if (newCompanyError) {
      console.error('Error creating company:', newCompanyError);
      throw new Error('Failed to create company');
    }

    existingCompany = newCompany;
    console.log('New company created:', existingCompany);
  } else {
    console.log('Company already exists:', existingCompany);
  }

  // Fetch the default project track for the company using default_project_track field
  const { data: defaultTrack, error: trackError } = await supabase
    .from('companies')
    .select('default_project_track')
    .eq('id', existingCompany.id)
    .single();
    
  if (trackError) {
    console.error('Error fetching default track from companies table:', trackError);
  }

  // Use the default_project_track directly from the company record
  const defaultTrackId = defaultTrack?.default_project_track || null;
  console.log('Default track ID from company record:', defaultTrackId);

  return {
    id: existingCompany.id,
    defaultTrackId: defaultTrackId
  };
}

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

export async function getWorkflowPrompt(supabase: any, isUpdate: boolean) {
  const workflowType = isUpdate ? 'summary_update' : 'summary_generation';

  const { data: prompt, error } = await supabase
    .from('workflow_prompts')
    .select('prompt_text')
    .eq('type', workflowType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('Error fetching workflow prompt:', error)
    throw new Error('Failed to get workflow prompt')
  }

  return prompt.prompt_text
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

export async function createMilestoneActionRecord(supabase: any, projectId: string | undefined, timeline: any) {
  if (!projectId) {
    console.warn('Project ID is undefined, skipping milestone action record creation.')
    return
  }

  const actions = Object.entries(timeline).map(([milestone, date]) => ({
    project_id: projectId,
    milestone: milestone,
    action_date: date,
    action_type: 'timeline_update',
    description: `Timeline updated for ${milestone} on ${date}`
  }))

  const { error } = await supabase
    .from('action_records')
    .insert(actions)

  if (error) {
    console.error('Error creating milestone action records:', error)
  }
}

export async function createReminderActionRecord(
  supabase: any, 
  projectId: string | undefined, 
  reminderDate: string,
  reason: string
) {
  if (!projectId) {
    console.warn('Project ID is undefined, skipping reminder action record creation.')
    return
  }

  const action = {
    project_id: projectId,
    action_type: 'reminder_creation',
    action_payload: {
      date: reminderDate,
      reason: reason,
      description: `Reminder set for ${reminderDate}: ${reason}`
    },
    status: 'executed',
    requires_approval: false,
    executed_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('action_records')
    .insert(action)

  if (error) {
    console.error('Error creating reminder action record:', error)
  } else {
    console.log('Created reminder action record for date:', reminderDate)
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
