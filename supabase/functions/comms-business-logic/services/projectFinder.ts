
import { formatPhoneNumber } from "../utils/formatters.ts";

/**
 * Finds a project by phone number from the communication
 * @param supabase Supabase client
 * @param communication Communication object
 * @returns Project ID if found, null otherwise
 */
export async function findProjectByPhoneNumber(supabase: any, communication: any): Promise<string | null> {
  try {
    // Extract phone numbers from the communication
    const phoneNumbers = communication.participants
      .filter((p: any) => p.type === 'phone')
      .map((p: any) => p.value);
      
    if (phoneNumbers.length === 0) {
      return null;
    }
    
    console.log('Searching for project match using phone numbers:', phoneNumbers);
    
    // Format the phone numbers for consistent comparison
    const formattedPhoneNumbers = phoneNumbers.map(formatPhoneNumber);
    console.log('Formatted phone numbers for search:', formattedPhoneNumbers);
    
    // Build a query to search for contacts with matching phone numbers
    // This uses LIKE queries for flexibility in matching different phone number formats
    const searchQuery = formattedPhoneNumbers.map((phone: string) => {
      return `phone_number.ilike.%${phone.substring(Math.max(0, phone.length - 10))}%`;
    }).join(',');
    
    console.log('Using search query:', searchQuery);
    
    // Query contacts table directly with the phone numbers
    const { data: matchingContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id')
      .or(searchQuery);
      
    if (contactsError) {
      console.error('Error searching contacts:', contactsError);
      return null;
    }
    
    if (!matchingContacts || matchingContacts.length === 0) {
      console.log('No matching contacts found');
      return null;
    }
    
    console.log('Found matching contacts:', matchingContacts);
    
    const contactIds = matchingContacts.map((c: any) => c.id);
    
    // Find projects associated with these contacts
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('project_id')
      .in('contact_id', contactIds)
      .limit(1);
      
    if (projectContactsError) {
      console.error('Error searching project contacts:', projectContactsError);
      return null;
    }
    
    if (!projectContacts || projectContacts.length === 0) {
      console.log('No matching projects found');
      return null;
    }
    
    console.log('Found matching project:', projectContacts[0].project_id);
    return projectContacts[0].project_id;
  } catch (error) {
    console.error('Error in findProjectByPhoneNumber:', error);
    return null;
  }
}
