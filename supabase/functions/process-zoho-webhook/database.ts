
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { ParsedProjectData } from './types.ts';

export async function handleCompany(supabase: any, projectData: ParsedProjectData, rawData: any) {
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('id', projectData.companyId)
    .single()

  if (!existingCompany) {
    const { error: companyError } = await supabase
      .from('companies')
      .insert([{ 
        id: projectData.companyId,
        name: `Zoho Company ${rawData.Company_ID || 'Unknown'}`
      }])
    
    if (companyError) throw companyError
  }
}

export async function getExistingProject(supabase: any, crmId: string) {
  const { data: existingProject } = await supabase
    .from('projects')
    .select('id, summary, project_track')
    .eq('crm_id', crmId)
    .maybeSingle()
  
  return existingProject;
}

export async function getMilestoneInstructions(supabase: any, nextStep: string, projectTrack: string) {
  if (!nextStep || !projectTrack) return null;
  
  const { data: milestoneData } = await supabase
    .from('project_track_milestones')
    .select('prompt_instructions')
    .eq('track_id', projectTrack)
    .eq('step_title', nextStep)
    .single()
  
  return milestoneData?.prompt_instructions || null;
}

export async function getWorkflowPrompt(supabase: any, isUpdate: boolean) {
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

export async function updateProject(supabase: any, projectId: string, data: any) {
  const { error: updateError } = await supabase
    .from('projects')
    .update(data)
    .eq('id', projectId)
  
  if (updateError) throw updateError;
}

export async function createProject(supabase: any, data: any) {
  const { error: createError } = await supabase
    .from('projects')
    .insert([data])
  
  if (createError) throw createError;
}

export async function logMilestoneUpdates(supabase: any, projectId: string | undefined, timeline: Record<string, string>) {
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
