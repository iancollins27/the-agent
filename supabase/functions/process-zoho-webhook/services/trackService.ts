
/**
 * Get track details from the project track ID
 * @param supabase Supabase client
 * @param projectTrackId Project track ID
 * @returns Object containing track roles, base prompt, and name
 */
export async function getTrackDetails(supabase: any, projectTrackId: string | null) {
  let trackRoles = '';
  let trackBasePrompt = '';
  let trackName = '';
  
  if (projectTrackId) {
    const { data: trackData, error: trackError } = await supabase
      .from('project_tracks')
      .select('Roles, "track base prompt", name')
      .eq('id', projectTrackId)
      .single();
      
    if (!trackError && trackData) {
      trackRoles = trackData.Roles || '';
      trackBasePrompt = trackData['track base prompt'] || '';
      trackName = trackData.name || '';
    }
  }
  
  return { trackRoles, trackBasePrompt, trackName };
}
