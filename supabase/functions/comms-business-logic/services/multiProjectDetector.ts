
import { formatPhoneNumber } from "../utils/formatters.ts";

/**
 * Check if this communication is potentially related to multiple projects
 * (e.g., between a project manager and a roofer)
 * @param supabase Supabase client
 * @param communication Communication object
 * @returns Boolean indicating if this might be a multi-project communication
 */
export async function isPotentialMultiProjectComm(supabase: any, communication: any): Promise<boolean> {
  try {
    // Extract participant information
    const participants = communication.participants || [];
    
    // Check if we have at least 2 participants (sender and receiver)
    if (participants.length < 2) {
      return false;
    }
    
    // Track if we found a project manager and a roofer
    let foundProjectManager = false;
    let foundRoofer = false;
    
    // Get phone numbers from participants
    const phoneNumbers = participants
      .filter((p: any) => p.type === 'phone')
      .map((p: any) => p.value);
      
    if (phoneNumbers.length < 2) {
      return false;
    }
    
    // Look up contacts associated with these phone numbers
    for (const phone of phoneNumbers) {
      const formattedPhone = formatPhoneNumber(phone);
      
      // Query to find this contact
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('role')
        .ilike('phone_number', `%${formattedPhone.slice(-10)}%`)
        .limit(1);
        
      if (error) {
        console.error('Error looking up contact role:', error);
        continue;
      }
      
      if (contacts && contacts.length > 0) {
        const role = contacts[0].role;
        if (role === 'project_manager' || role === 'ProjectManager' || role === 'PM' || role === 'bidlist_pm') {
          foundProjectManager = true;
        } else if (role === 'roofer' || role === 'contractor' || role === 'vendor') {
          foundRoofer = true;
        }
      }
    }
    
    // If we found both a project manager and a roofer, this might be a multi-project communication
    return foundProjectManager && foundRoofer;
  } catch (error) {
    console.error('Error determining multi-project status:', error);
    return false;
  }
}
