
/**
 * Contact-based authentication utilities for homeowner access
 * These functions help create RLS policies that work with contact_id instead of auth.uid()
 */

export function createContactBasedClient(supabaseUrl: string, supabaseKey: string, contactId: string) {
  // For now, we'll use the service role but this should be replaced with proper contact auth
  // TODO: Implement proper contact JWT authentication
  const { createClient } = require('https://esm.sh/@supabase/supabase-js@2')
  
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        'X-Contact-ID': contactId
      }
    }
  })
  
  return client
}

/**
 * Security definer function to check if a contact can access a project
 */
export async function canContactAccessProject(supabase: any, contactId: string, projectId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('contact_id', contactId)
      .eq('project_id', projectId)
      .single()
    
    return !error && data !== null
  } catch (error) {
    console.error('Error checking contact project access:', error)
    return false
  }
}

/**
 * Get projects accessible to a specific contact
 */
export async function getContactProjects(supabase: any, contactId: string) {
  try {
    const { data, error } = await supabase
      .from('project_contacts')
      .select(`
        project_id,
        projects!inner(
          id,
          crm_id, 
          company_id,
          project_name,
          summary,
          next_step,
          Address,
          Project_status
        )
      `)
      .eq('contact_id', contactId)
    
    if (error) {
      console.error('Error fetching contact projects:', error)
      return []
    }
    
    return data?.map(pc => pc.projects) || []
  } catch (error) {
    console.error('Error in getContactProjects:', error)
    return []
  }
}
