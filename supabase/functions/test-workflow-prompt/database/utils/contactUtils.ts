
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Find a contact ID based on name, role, or partial match
 * @param supabase Supabase client
 * @param nameOrRole Name or role identifier
 * @param projectId Project ID
 * @returns Contact ID if found, null otherwise
 */
export async function findContactId(
  supabase: SupabaseClient,
  nameOrRole: string,
  projectId: string
): Promise<string | null> {
  if (!nameOrRole || !projectId) {
    console.log("Missing name/role or project ID in findContactId");
    return null;
  }
  
  try {
    console.log(`findContactId: Searching for contact "${nameOrRole}" in project ${projectId}`);
    
    // First try to find an exact match
    const exactMatchQuery = await supabase
      .from('project_contacts')
      .select(`
        contact_id,
        contacts:contact_id (
          id, 
          full_name,
          role
        )
      `)
      .eq('project_id', projectId);
      
    console.log(`findContactId: Found ${exactMatchQuery.data?.length || 0} project contacts`);
    
    if (exactMatchQuery.data) {
      // Name exact match
      const nameExactMatch = exactMatchQuery.data.find(
        row => row.contacts?.full_name?.toLowerCase() === nameOrRole.toLowerCase()
      );
      if (nameExactMatch) {
        console.log(`findContactId: Found exact name match: ${nameExactMatch.contacts.full_name}`);
        return nameExactMatch.contact_id;
      }
      
      // Role exact match
      const roleExactMatch = exactMatchQuery.data.find(
        row => row.contacts?.role?.toLowerCase() === nameOrRole.toLowerCase()
      );
      if (roleExactMatch) {
        console.log(`findContactId: Found exact role match: ${roleExactMatch.contacts.role}`);
        return roleExactMatch.contact_id;
      }
      
      // Common roles mapping (case-insensitive check)
      const roleMapping: Record<string, string[]> = {
        "homeowner": ["HO", "Homeowner", "Customer", "Client"],
        "roofer": ["Roofer", "Roofing Contractor", "Roofing Company"],
        "project manager": ["PM", "Project Manager", "BidList Project Manager"],
        "solar": ["Solar", "Solar Rep", "Solar Ops", "Solar Representative"]
      };
      
      // Find by role category
      for (const [category, aliases] of Object.entries(roleMapping)) {
        if (aliases.some(alias => alias.toLowerCase() === nameOrRole.toLowerCase()) || 
            category.toLowerCase() === nameOrRole.toLowerCase()) {
          // Find contacts with matching role category
          const matchingContact = exactMatchQuery.data.find(row => {
            const contactRole = row.contacts?.role?.toLowerCase();
            return contactRole && (
              aliases.some(alias => alias.toLowerCase() === contactRole) ||
              contactRole.includes(category.toLowerCase())
            );
          });
          
          if (matchingContact) {
            console.log(`findContactId: Found role category match: ${matchingContact.contacts.full_name} (${matchingContact.contacts.role})`);
            return matchingContact.contact_id;
          }
        }
      }
      
      // Partial name match as fallback
      const partialNameMatch = exactMatchQuery.data.find(
        row => row.contacts?.full_name?.toLowerCase().includes(nameOrRole.toLowerCase()) ||
              nameOrRole.toLowerCase().includes(row.contacts?.full_name?.toLowerCase() || '')
      );
      if (partialNameMatch) {
        console.log(`findContactId: Found partial name match: ${partialNameMatch.contacts.full_name}`);
        return partialNameMatch.contact_id;
      }
      
      // Partial role match as last resort
      const partialRoleMatch = exactMatchQuery.data.find(
        row => row.contacts?.role?.toLowerCase().includes(nameOrRole.toLowerCase()) ||
              nameOrRole.toLowerCase().includes(row.contacts?.role?.toLowerCase() || '')
      );
      if (partialRoleMatch) {
        console.log(`findContactId: Found partial role match: ${partialRoleMatch.contacts.role}`);
        return partialRoleMatch.contact_id;
      }
    }
    
    console.log(`findContactId: No match found for "${nameOrRole}" in project ${projectId}`);
    return null;
  } catch (error) {
    console.error(`findContactId: Error finding contact ID for "${nameOrRole}":`, error);
    return null;
  }
}
