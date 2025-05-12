
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
    console.log(`Fetching contacts for project: ${projectId}`);
    
    // Query project_contacts to get the contact_ids for this project
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('project_id', projectId);
    
    if (projectContactsError) {
      console.error("Error fetching project contacts:", projectContactsError);
      return [];
    }
    
    if (!projectContacts || projectContacts.length === 0) {
      console.log("No contacts found for this project");
      return [];
    }
    
    // Get all the contact IDs for this project
    const contactIds = projectContacts.map(pc => pc.contact_id);
    console.log(`Found ${contactIds.length} contact IDs for project`);
    
    // Query the contacts table to get the full contact information
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role, email, phone_number')
      .in('id', contactIds);
    
    if (contactsError) {
      console.error("Error fetching contact details:", contactsError);
      return [];
    }
    
    console.log(`Retrieved ${contacts?.length || 0} contacts with details`);
    
    // Return the contact information formatted for use in the MCP context
    return contacts?.map(contact => ({
      id: contact.id,
      full_name: contact.full_name,
      role: contact.role,
      email: contact.email,
      phone_number: contact.phone_number
    })) || [];
  } catch (error) {
    console.error("Error in getProjectContacts:", error);
    return [];
  }
}

/**
 * Format contacts for inclusion in the MCP context
 * @param contacts The array of contacts
 * @returns A formatted string with contact information
 */
export function formatContactsForContext(contacts: ContactInfo[]): string {
  if (!contacts || contacts.length === 0) {
    return "No contacts available for this project.";
  }
  
  return contacts.map(contact => {
    let contactInfo = `- ${contact.full_name} (Role: ${contact.role}, ID: ${contact.id})`;
    if (contact.email) {
      contactInfo += `, Email: ${contact.email}`;
    }
    if (contact.phone_number) {
      contactInfo += `, Phone: ${contact.phone_number}`;
    }
    return contactInfo;
  }).join('\n');
}
