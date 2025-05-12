
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

/**
 * Contact data interface
 */
interface ContactInfo {
  id: string;
  full_name: string;
  role: string;
  email?: string;
  phone_number?: string;
}

/**
 * Get all contacts associated with a project
 * @param supabase The Supabase client
 * @param projectId The project ID to fetch contacts for
 * @returns An array of contact information objects
 */
export async function getProjectContacts(
  supabase: SupabaseClient,
  projectId: string
): Promise<ContactInfo[]> {
  try {
    console.log(`[DEBUG] Contacts: Starting getProjectContacts for project: ${projectId}`);
    
    // Query project_contacts to get the contact_ids for this project
    console.log(`[DEBUG] Contacts: Querying project_contacts table for project: ${projectId}`);
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('project_id', projectId);
    
    if (projectContactsError) {
      console.error("[DEBUG] Contacts: Error fetching project_contacts:", projectContactsError);
      return [];
    }
    
    console.log(`[DEBUG] Contacts: project_contacts query returned: ${projectContacts ? projectContacts.length : 0} rows`);
    
    if (!projectContacts || projectContacts.length === 0) {
      console.log("[DEBUG] Contacts: No contacts found for this project in project_contacts table");
      
      // Fallback query - check if any contacts exist at all in the system
      console.log("[DEBUG] Contacts: Checking if any contacts exist in the contacts table as fallback");
      const { count, error: countError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });
        
      if (!countError) {
        console.log(`[DEBUG] Contacts: Total contacts in system: ${count}`);
      }
      
      return [];
    }
    
    // Get all the contact IDs for this project
    const contactIds = projectContacts.map(pc => pc.contact_id);
    console.log(`[DEBUG] Contacts: Found ${contactIds.length} contact IDs: ${contactIds.join(', ')}`);
    
    // Query the contacts table to get the full contact information
    console.log(`[DEBUG] Contacts: Querying contacts table for ${contactIds.length} contacts`);
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role, email, phone_number')
      .in('id', contactIds);
    
    if (contactsError) {
      console.error("[DEBUG] Contacts: Error fetching contact details:", contactsError);
      return [];
    }
    
    if (!contacts || contacts.length === 0) {
      console.log("[DEBUG] Contacts: No contacts found in contacts table for the given IDs");
      return [];
    }
    
    console.log(`[DEBUG] Contacts: Successfully retrieved ${contacts.length} contact records`);
    contacts.forEach((contact, index) => {
      console.log(`[DEBUG] Contacts: Contact ${index+1}: ${JSON.stringify(contact)}`);
    });
    
    // Return the contact information formatted for use in the MCP context
    return contacts?.map(contact => ({
      id: contact.id,
      full_name: contact.full_name,
      role: contact.role,
      email: contact.email,
      phone_number: contact.phone_number
    })) || [];
  } catch (error) {
    console.error("[DEBUG] Contacts: Error in getProjectContacts:", error);
    return [];
  }
}

/**
 * Format contacts for inclusion in the MCP context
 * @param contacts The array of contacts
 * @returns A formatted string with contact information
 */
export function formatContactsForContext(contacts: ContactInfo[]): string {
  console.log(`[DEBUG] Contacts: Starting formatContactsForContext with ${contacts?.length || 0} contacts`);
  
  if (!contacts || contacts.length === 0) {
    console.log("[DEBUG] Contacts: No contacts to format, returning default message");
    return "No contacts available for this project.";
  }
  
  const formatted = contacts.map(contact => {
    let contactInfo = `- ${contact.full_name} (Role: ${contact.role}, ID: ${contact.id})`;
    if (contact.email) {
      contactInfo += `, Email: ${contact.email}`;
    }
    if (contact.phone_number) {
      contactInfo += `, Phone: ${contact.phone_number}`;
    }
    return contactInfo;
  }).join('\n');
  
  console.log(`[DEBUG] Contacts: Formatted ${contacts.length} contacts, result length: ${formatted.length}`);
  console.log(`[DEBUG] Contacts: First contact formatted: ${formatted.split('\n')[0]}`);
  
  return formatted;
}
