
// Re-export all functions from the database modules
export { 
  handleCompany,
  getCompanyByZohoId,
  createCompany
} from './db/companies.ts'

export {
  getExistingProject,
  createProject,
  updateProject,
  setNextCheckDate
} from './db/projects.ts'

export {
  getWorkflowPrompt,
  getActionDetectionPrompt
} from './db/workflow-prompts.ts'

export {
  createMilestoneActionRecord,
  createReminderActionRecord
} from './db/action-records.ts'

export const getMilestoneInstructions = async (supabase: any, nextStep: string | null, trackId: string | null) => {
  if (!nextStep || !trackId) {
    return ''
  }

  try {
    const { data, error } = await supabase
      .from('project_track_milestones')
      .select('prompt_instructions')
      .eq('track_id', trackId)
      .eq('step_title', nextStep)
      .single()

    if (error) {
      console.error('Error fetching milestone instructions:', error)
      return ''
    }

    return data?.prompt_instructions || ''
  } catch (error) {
    console.error('Exception fetching milestone instructions:', error)
    return ''
  }
}
