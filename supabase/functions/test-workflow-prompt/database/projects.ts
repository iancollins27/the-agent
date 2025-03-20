
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Sets the next check date for a project
 */
export async function setProjectNextCheckDate(
  supabase: SupabaseClient,
  projectId: string,
  daysUntilCheck: number
) {
  try {
    // Calculate the next check date
    const nextCheckDate = new Date();
    nextCheckDate.setDate(nextCheckDate.getDate() + daysUntilCheck);
    
    console.log(`Setting next check date for project ${projectId} to ${nextCheckDate.toISOString()} (${daysUntilCheck} days from now)`);
    
    const { error } = await supabase
      .from('projects')
      .update({
        next_check_date: nextCheckDate.toISOString()
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("Error setting next check date:", error);
      throw new Error(`Failed to set next check date: ${error.message}`);
    }
    
    return nextCheckDate.toISOString();
  } catch (error) {
    console.error("Error setting project next check date:", error);
    return null;
  }
}

/**
 * Updates a project's next_check_date
 */
export async function setNextCheckDate(
  supabase: any,
  projectId: string,
  nextCheckDate: string | null
) {
  try {
    console.log(`Setting next_check_date for project ${projectId} to ${nextCheckDate}`);
    
    // Get the current next_check_date first (for UI display purposes only)
    const { data: currentData, error: fetchError } = await supabase
      .from('projects')
      .select('next_check_date')
      .eq('id', projectId)
      .single();
      
    if (fetchError) {
      console.error("Error fetching current next_check_date:", fetchError);
      throw fetchError;
    }
    
    // Update with new next_check_date (without storing the previous value)
    const { data, error } = await supabase
      .from('projects')
      .update({ 
        next_check_date: nextCheckDate
      })
      .eq('id', projectId);
      
    if (error) {
      console.error("Error setting next_check_date:", error);
      throw error;
    }
    
    // Return both current and new values for UI display purposes
    return {
      currentValue: currentData?.next_check_date || null,
      newValue: nextCheckDate
    };
  } catch (error) {
    console.error("Error in setNextCheckDate:", error);
    throw error;
  }
}
