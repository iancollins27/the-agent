
/**
 * Creates milestone action records for a project
 * @param supabase Supabase client
 * @param projectId Project ID
 * @param timeline Timeline data with milestone dates
 */
export async function createMilestoneActionRecord(supabase: any, projectId: string | undefined, timeline: any) {
  if (!projectId) {
    console.warn('Project ID is undefined, skipping milestone action record creation.')
    return
  }

  try {
    // Validate timeline data before processing
    if (!timeline || typeof timeline !== 'object' || Object.keys(timeline).length === 0) {
      console.log('No timeline data to process for action records. Skipping.')
      return
    }

    // Filter out empty timeline values and create action records only for milestones with dates
    const filteredTimeline = Object.entries(timeline).filter(([_, date]) => date && String(date).trim() !== '')
    
    if (filteredTimeline.length === 0) {
      console.log('No valid timeline entries with dates to record. Skipping.')
      return
    }

    console.log(`Creating ${filteredTimeline.length} milestone tracking records for project ${projectId}`)
    
    // Note: These are just tracking records for milestones, not actual actions that require execution
    const milestoneRecords = filteredTimeline.map(([milestone, date]) => ({
      project_id: projectId,
      action_type: 'data_update', // Use a valid action_type from the schema
      action_payload: {
        field: 'timeline',
        milestone: milestone,
        value: date,
        date: date,
        is_milestone_tracking: true // Flag to identify these are just milestone tracking records
      },
      status: 'executed', // Already executed since these are just records of data updates
      requires_approval: false,
      message: `Timeline milestone recorded: ${milestone} on ${date}`,
      executed_at: new Date().toISOString()
    }))

    const { data, error } = await supabase
      .from('action_records')
      .insert(milestoneRecords)

    if (error) {
      console.error('Error creating milestone tracking records:', error)
    } else {
      console.log(`Successfully created ${milestoneRecords.length} milestone tracking records`)
    }
  } catch (error) {
    console.error('Exception in createMilestoneActionRecord:', error)
  }
}

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
