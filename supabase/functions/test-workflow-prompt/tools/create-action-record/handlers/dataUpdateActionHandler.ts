/**
 * Handler for data update action type
 */
import { DataUpdateActionParams } from '../types.ts';

export async function handleDataUpdateAction(
  supabase: any,
  promptRunId: string,
  projectId: string,
  actionData: DataUpdateActionParams
): Promise<{ action_record_id?: string, error?: string }> {
  try {
    if (!actionData.field || actionData.value === undefined) {
      throw new Error("Field and value are required for data update actions");
    }
    
    // Create an action payload with the data update details
    const actionPayload = {
      field: actionData.field,
      value: actionData.value,
      description: actionData.description || `Update ${actionData.field} to ${actionData.value}`
    };
    
    console.log("Creating data update action with payload:", actionPayload);
    
    // Create the data update action record
    const { data, error } = await supabase
      .from('action_records')
      .insert({
        prompt_run_id: promptRunId,
        project_id: projectId,
        action_type: 'data_update',
        action_payload: actionPayload,
        requires_approval: true,
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) {
      console.error("Error creating data update action record:", error);
      throw new Error(`Failed to create data update action: ${error.message}`);
    }
    
    console.log("Data update action record created successfully:", data);
    return { action_record_id: data.id };
  } catch (error) {
    console.error("Error in handleDataUpdateAction:", error);
    return { error: error.message || "Unknown error creating data update action" };
  }
}
