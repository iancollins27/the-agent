
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
      console.log('No phone numbers found in communication participants');
      return null;
    }
    
    console.log('Searching for project match using phone numbers:', phoneNumbers);
    
    // Format the phone numbers for consistent comparison
    const formattedPhoneNumbers = phoneNumbers.map(formatPhoneNumber);
    console.log('Formatted phone numbers for search:', formattedPhoneNumbers);
    
    // For each phone number, try the full number and also just the last 10 digits
    // This helps match numbers regardless of country code format
    const searchQueries = [];
    
    for (const phone of formattedPhoneNumbers) {
      // Get the last 10 digits (or fewer if the number is shorter)
      const last10Digits = phone.substring(Math.max(0, phone.length - 10));
      
      // Add queries for both the full number and the last 10 digits
      searchQueries.push(`phone_number.ilike.%${phone}%`);
      
      // Only add the 10-digit version if it's different from the full number
      if (last10Digits !== phone) {
        searchQueries.push(`phone_number.ilike.%${last10Digits}%`);
      }
    }
    
    const searchQuery = searchQueries.join(',');
    
    console.log('Using search query:', searchQuery);
    
    // Query contacts table directly with the phone numbers
    const { data: matchingContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, phone_number')
      .or(searchQuery);
      
    if (contactsError) {
      console.error('Error searching contacts:', contactsError);
      return null;
    }
    
    if (!matchingContacts || matchingContacts.length === 0) {
      console.log('No matching contacts found');
      return null;
    }
    
    console.log('Found matching contacts:', matchingContacts.map(c => ({id: c.id, phone: c.phone_number})));
    
    const contactIds = matchingContacts.map((c: any) => c.id);
    
    // Find projects associated with these contacts
    const { data: projectContacts, error: projectContactsError } = await supabase
      .from('project_contacts')
      .select('project_id, contact_id')
      .in('contact_id', contactIds)
      .limit(10);
      
    if (projectContactsError) {
      console.error('Error searching project contacts:', projectContactsError);
      return null;
    }
    
    if (!projectContacts || projectContacts.length === 0) {
      console.log('No matching projects found for contacts:', contactIds);
      return null;
    }
    
    console.log('Found matching project contacts:', projectContacts);
    
    // Get the corresponding projects to check if they're valid
    const projectIds = projectContacts.map(pc => pc.project_id);
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id')
      .in('id', projectIds)
      .limit(1);
      
    if (projectsError) {
      console.error('Error verifying projects:', projectsError);
      return null;
    }
    
    if (!projects || projects.length === 0) {
      console.log('No valid projects found. Projects might have been deleted.');
      return null;
    }
    
    console.log('Found matching project:', projects[0].id);
    return projects[0].id;
  } catch (error) {
    console.error('Error in findProjectByPhoneNumber:', error);
    return null;
  }
}
