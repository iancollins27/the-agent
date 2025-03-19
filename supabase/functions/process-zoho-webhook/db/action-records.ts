
/**
 * Functions for handling action records
 */
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
    action_type: 'set_future_reminder',
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
