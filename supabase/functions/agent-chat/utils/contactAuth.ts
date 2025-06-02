
/**
 * Contact-based authentication utilities for homeowner access
 * These functions help create RLS policies that work with contact_id instead of auth.uid()
 */

export function createContactBasedClient(supabaseUrl: string, supabaseKey: string, contactId: string) {
  const { createClient } = require('https://esm.sh/@supabase/supabase-js@2')
  
  // Create client with anon key and contact context
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
    // Use RPC to check access with security definer privileges
    const { data, error } = await supabase.rpc('contact_can_access_project', {
      contact_id: contactId,
      project_id: projectId
    })
    
    if (error) {
      console.error('Error checking contact project access:', error)
      return false
    }
    
    return data === true
  } catch (error) {
    console.error('Error in canContactAccessProject:', error)
    return false
  }
}

/**
 * Get projects accessible to a specific contact using security definer
 */
export async function getContactProjects(supabase: any, contactId: string) {
  try {
    // Use RPC to get projects with security definer privileges
    const { data, error } = await supabase.rpc('get_contact_projects', {
      contact_id: contactId
    })
    
    if (error) {
      console.error('Error fetching contact projects:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('Error in getContactProjects:', error)
    return []
  }
}

/**
 * Create a contact-authenticated supabase client that respects RLS
 */
export function createContactAuthenticatedClient(supabaseUrl: string, supabaseAnonKey: string, contactId: string) {
  const { createClient } = require('https://esm.sh/@supabase/supabase-js@2')
  
  // Use anon key with contact context for RLS
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    },
    global: {
      headers: {
        'X-Contact-ID': contactId,
        'X-Contact-Auth': 'true'
      }
    }
  })
  
  return client
}
