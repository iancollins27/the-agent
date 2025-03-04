
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { ParsedProjectData } from './types.ts'

export async function handleCompany(
  supabase: ReturnType<typeof createClient>,
  projectData: ParsedProjectData,
  rawData: any
) {
  console.log('Handling company with Zoho ID:', projectData.zohoCompanyId);
  
  // First, try to find an existing company with this Zoho ID
  const { data: existingCompanies, error: findError } = await supabase
    .from('companies')
    .select('id, name, default_project_track')
    .eq('zoho_id', projectData.zohoCompanyId)
    .maybeSingle();

  if (findError) {
    console.error('Error finding company:', findError);
    throw findError;
  }

  // If company exists, use its UUID
  if (existingCompanies) {
    console.log('Found existing company:', existingCompanies);
    return {
      id: existingCompanies.id,
      defaultTrackId: existingCompanies.default_project_track
    };
  }

  // If company doesn't exist, create it and get the new UUID
  const companyName = rawData.Company_Name || rawData.rawData?.Company_Name || 'Unknown Company';
  console.log('Creating new company with name:', companyName);

  const { data: newCompany, error: createError } = await supabase
    .from('companies')
    .insert({
      name: companyName,
      zoho_id: projectData.zohoCompanyId
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating company:', createError);
    throw createError;
  }

  console.log('Created new company:', newCompany);
  return {
    id: newCompany.id,
    defaultTrackId: newCompany.default_project_track
  };
}

export async function getExistingProject(
  supabase: ReturnType<typeof createClient>,
  crmId: string
) {
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id, summary, project_track')
    .eq('crm_id', crmId)
    .maybeSingle()
  
  return existingProject;
}

export async function getMilestoneInstructions(
  supabase: ReturnType<typeof createClient>,
  nextStep: string | undefined,
  trackId: string | undefined
) {
  if (!nextStep || !trackId) return null;
  
  console.log(`Fetching milestone instructions for step: ${nextStep} and track: ${trackId}`);
  
  const { data: milestoneData, error } = await supabase
    .from('project_track_milestones')
    .select('prompt_instructions')
    .eq('track_id', trackId)
    .eq('step_title', nextStep)
    .maybeSingle()
  
  if (error) {
    console.error('Error fetching milestone instructions:', error);
    return null;
  }
  
  console.log('Milestone data retrieved:', milestoneData);
  return milestoneData?.prompt_instructions || null;
}

export async function getWorkflowPrompt(
  supabase: ReturnType<typeof createClient>,
  isUpdate: boolean
) {
  const { data: promptData } = await supabase
    .from('workflow_prompts')
    .select('prompt_text')
    .eq('type', isUpdate ? 'summary_update' : 'summary_generation')
    .single()

  if (!promptData) {
    throw new Error('Prompt not found')
  }

  return promptData.prompt_text;
}

export async function updateProject(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  data: {
    summary: string;
    next_step: string | undefined;
    last_action_check: string;
    company_id: string;
    project_track?: string | null;
  }
) {
  const { error: updateError } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)
  
  if (updateError) throw updateError;
}

export async function createProject(
  supabase: ReturnType<typeof createClient>,
  data: {
    summary: string;
    next_step: string | undefined;
    last_action_check: string;
    company_id: string;
    crm_id: string;
    project_track?: string | null;
  }
) {
  const { error: createError } = await supabase
    .from('projects')
    .insert([data])
  
  if (createError) throw createError;
}

export async function logMilestoneUpdates(
  supabase: ReturnType<typeof createClient>,
  projectId: string | undefined,
  timeline: ParsedProjectData['timeline']
) {
  const milestones = Object.entries(timeline)
    .filter(([_, value]) => value.trim() !== '')
    .map(([milestone]) => milestone)

  if (milestones.length > 0) {
    await supabase
      .from('action_logs')
      .insert({
        project_id: projectId,
        action_type: 'milestone_update',
        action_description: `Project milestones updated: ${milestones.join(', ')}`
      })
  }
}
