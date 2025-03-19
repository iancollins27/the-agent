
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Sets the next check date for a project
 */
export async function setNextCheckDate(
  supabase: SupabaseClient,
  projectId: string,
  nextCheckDate: string | null
) {
  if (!projectId) {
    console.warn('Project ID is undefined, cannot set next check date.');
    return;
  }

  const { error } = await supabase
    .from('projects')
    .update({ next_check_date: nextCheckDate })
    .eq('id', projectId);

  if (error) {
    console.error('Error setting next check date:', error);
    throw new Error('Failed to set next check date');
  } else {
    console.log('Set next check date to:', nextCheckDate);
  }
}

/**
 * Creates milestone action records for timeline updates
 */
export async function createMilestoneActionRecord(
  supabase: SupabaseClient, 
  projectId: string | undefined, 
  timeline: any
) {
  if (!projectId) {
    console.warn('Project ID is undefined, skipping milestone action record creation.');
    return;
  }

  const actions = Object.entries(timeline).map(([milestone, date]) => ({
    project_id: projectId,
    milestone: milestone,
    action_date: date,
    action_type: 'timeline_update',
    description: `Timeline updated for ${milestone} on ${date}`
  }));

  const { error } = await supabase
    .from('action_records')
    .insert(actions);

  if (error) {
    console.error('Error creating milestone action records:', error);
  }
}

/**
 * Creates a reminder action record
 */
export async function createReminderActionRecord(
  supabase: SupabaseClient, 
  projectId: string | undefined, 
  reminderDate: string,
  reason: string
) {
  if (!projectId) {
    console.warn('Project ID is undefined, skipping reminder action record creation.');
    return;
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
  };

  const { error } = await supabase
    .from('action_records')
    .insert(action);

  if (error) {
    console.error('Error creating reminder action record:', error);
  } else {
    console.log('Created reminder action record for date:', reminderDate);
  }
}
