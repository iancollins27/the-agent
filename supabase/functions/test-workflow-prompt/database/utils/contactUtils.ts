
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Find a contact by name, role, or partial match
 */
export async function findContactId(
  supabase: SupabaseClient,
  contactName: string,
  projectId: string
): Promise<string | null> {
  if (!contactName || contactName.trim().length < 3) {
    return null;
  }

  // Normalize contact role names for matching
  const normalizeRoleName = (role: string): string => {
    const roleMapping: Record<string, string> = {
      'homeowner': 'HO',
      'home owner': 'HO',
      'ho': 'HO',
      'customer': 'HO',
      'client': 'HO',
      'roofer': 'Roofer',
      'roofing contractor': 'Roofer',
      'solar': 'Solar',
      'solar sales': 'Solar',
      'solar rep': 'Solar',
      'project manager': 'BidList Project Manager',
      'bidlist pm': 'BidList Project Manager',
      'manager': 'BidList Project Manager'
    };
    
    const normalizedRole = role.toLowerCase().trim();
    return roleMapping[normalizedRole] || role;
  };

  console.log(`Looking for contact "${contactName}" (normalized role: "${normalizeRoleName(contactName)}")`);

  try {
    // Check project_contacts first to get contacts associated with this project
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('project_id', projectId);
    
    if (projectContactsError) {
      console.error("Error fetching project contacts:", projectContactsError);
    } else if (projectContacts && projectContacts.length > 0) {
      // If we have project contacts, look for a match among them
      const contactIds = projectContacts.map(pc => pc.contact_id);
      
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, full_name, role')
        .in('id', contactIds);
      
      if (contactsError) {
        console.error("Error fetching contacts by IDs:", contactsError);
      } else if (contacts && contacts.length > 0) {
        console.log(`Found ${contacts.length} contacts for this project`);
        
        // Try exact match on full name
        const exactMatch = contacts.find(c => 
          c.full_name.toLowerCase() === contactName.toLowerCase());
        
        if (exactMatch) {
          console.log(`Found exact name match: ${exactMatch.full_name} (${exactMatch.id})`);
          return exactMatch.id;
        }
        
        // Check if contactName is a role and try to match by role
        const normalizedSearchRole = normalizeRoleName(contactName);
        const roleMatch = contacts.find(c => {
          const normalizedContactRole = normalizeRoleName(c.role);
          return normalizedContactRole === normalizedSearchRole;
        });
        
        if (roleMatch) {
          console.log(`Found role match: ${roleMatch.full_name} with role ${roleMatch.role} (${roleMatch.id})`);
          return roleMatch.id;
        }
        
        // Try partial match on full name
        const partialMatch = contacts.find(c => 
          c.full_name.toLowerCase().includes(contactName.toLowerCase()) || 
          contactName.toLowerCase().includes(c.full_name.toLowerCase()));
        
        if (partialMatch) {
          console.log(`Found partial name match: ${partialMatch.full_name} (${partialMatch.id})`);
          return partialMatch.id;
        }
      }
    }
    
    // If no match found in project contacts, try a broader search with role matching
    if (contactName.toLowerCase() === 'homeowner' || contactName.toLowerCase() === 'ho') {
      const { data: hoContacts, error: hoError } = await supabase
        .from('contacts')
        .select('id, full_name, role')
        .eq('role', 'HO')
        .limit(1);
      
      if (!hoError && hoContacts && hoContacts.length > 0) {
        console.log(`Found homeowner by role: ${hoContacts[0].full_name} (${hoContacts[0].id})`);
        return hoContacts[0].id;
      }
    }
    
    // Try all contacts as a fallback with name matching
    const { data: allContacts, error: allContactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role')
      .ilike('full_name', `%${contactName}%`)
      .limit(1);
    
    if (allContactsError) {
      console.error("Error searching all contacts:", allContactsError);
    } else if (allContacts && allContacts.length > 0) {
      console.log(`Found contact match for "${contactName}": ${allContacts[0].full_name}`);
      return allContacts[0].id;
    }
    
    console.log(`No contact found for name: "${contactName}"`);
    return null;
  } catch (error) {
    console.error("Error finding contact:", error);
    return null;
  }
}
