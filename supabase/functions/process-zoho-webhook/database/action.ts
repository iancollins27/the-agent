
/**
 * Creates a reminder action record for a project
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param reminderDate Reminder date
 * @param reason Reason for the reminder
 */
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
    reminder_date: reminderDate,
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

/**
 * Updates the next check date for a project
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param nextCheckDate Next check date or null to clear
 */
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
