
import { supabase } from "@/integrations/supabase/client";

export const fetchRooferContacts = async (projectIds: string[]) => {
  const rooferContactMap = new Map();
  
  if (projectIds.length > 0) {
    const { data: contactsData, error: contactsError } = await supabase
      .from('project_contacts')
      .select(`
        project_id,
        contacts:contact_id (
          id, full_name, role
        )
      `)
      .in('project_id', projectIds);
    
    if (!contactsError && contactsData) {
      contactsData.forEach(item => {
        if (item.contacts && item.contacts.role === 'Roofer') {
          rooferContactMap.set(item.project_id, item.contacts.full_name);
        }
      });
    } else {
      console.error("Error fetching roofer contacts:", contactsError);
    }
  }
  
  return rooferContactMap;
};
