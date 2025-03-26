
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { ContactPayload, ContactProcessResult } from './types.ts';
import { normalizeRole } from './utils.ts';

// Find or create project by CRM ID
export async function getProjectByCrmId(supabase: SupabaseClient, crmId: string): Promise<{ id: string }> {
  console.log(`Looking for project with CRM ID: ${crmId}`);
  console.log(`Type of CRM ID: ${typeof crmId}`);
  console.log(`Raw CRM ID value: ${crmId}`);
  
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('crm_id', crmId)
    .single();

  if (projectError) {
    console.error('Error finding project:', projectError);
    throw new Error(`Project with Bid_ID ${crmId} not found: ${projectError.message}`);
  }

  console.log(`Found project with ID: ${project.id} for Bid_ID: ${crmId}`);
  return project;
}

// Process a single contact
export async function processContact(
  supabase: SupabaseClient, 
  contact: ContactPayload, 
  projectId: string
): Promise<ContactProcessResult> {
  try {
    console.log(`Processing contact: ${contact.name}, ${contact.email}, ${contact.number}, role: ${contact.role}`);
    
    // Normalize the role
    const originalRole = contact.role;
    const role = normalizeRole(contact.role);
    console.log(`Normalized role: "${role}" (original: "${originalRole}")`);
    
    // Check if contact already exists with this email or phone number
    let contactQueryCondition = '';
    
    // Build the query condition based on available contact details
    if (contact.email && contact.number) {
      contactQueryCondition = `email.eq.${contact.email},phone_number.eq.${contact.number}`;
    } else if (contact.email) {
      contactQueryCondition = `email.eq.${contact.email}`;
    } else if (contact.number) {
      contactQueryCondition = `phone_number.eq.${contact.number}`;
    } else {
      // If no email or phone, we can't reliably find the contact
      console.log('No email or phone provided, treating as new contact');
      contactQueryCondition = 'id.eq.00000000-0000-0000-0000-000000000000'; // Will not match anything
    }
    
    const { data: existingContacts, error: lookupError } = await supabase
      .from('contacts')
      .select('id, full_name, email, phone_number, role')
      .or(contactQueryCondition);
      
    if (lookupError) {
      console.error('Error looking up existing contact:', lookupError);
      return { status: 'error', message: `Error looking up contact: ${lookupError.message}`, contact };
    }

    let contactId;
    
    if (existingContacts && existingContacts.length > 0) {
      // Use existing contact but update its information
      contactId = existingContacts[0].id;
      console.log(`Updating existing contact with ID: ${contactId}`);
      
      // Only update non-empty fields
      const updateData: {
        full_name?: string;
        phone_number?: string;
        email?: string;
        role?: string;
      } = {};
      
      if (contact.name && contact.name.trim() !== '') updateData.full_name = contact.name;
      if (contact.number && contact.number.trim() !== '') updateData.phone_number = contact.number;
      if (contact.email && contact.email.trim() !== '') updateData.email = contact.email;
      if (role && role.trim() !== '') updateData.role = role;
      
      // Only update if there are changes
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(updateData)
          .eq('id', contactId);
          
        if (updateError) {
          console.error('Error updating contact:', updateError);
          return { status: 'error', message: `Error updating contact: ${updateError.message}`, contact };
        }
        
        console.log(`Successfully updated contact information for ID: ${contactId}`, updateData);
      } else {
        console.log(`No changes needed for contact ID: ${contactId}`);
      }
    } else {
      // Create new contact
      console.log(`Creating new contact: ${contact.name} with role: ${role}`);
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          full_name: contact.name,
          phone_number: contact.number,
          email: contact.email,
          role: role
        })
        .select('id')
        .single();
        
      if (createError) {
        console.error('Error creating contact:', createError);
        return { status: 'error', message: `Error creating contact: ${createError.message}`, contact };
      }
      
      contactId = newContact.id;
      console.log(`Created new contact with ID: ${contactId}`);
    }

    // Link contact to project if not already linked
    await linkContactToProject(supabase, contactId, projectId);

    return { status: 'success', contactId, contact };
  } catch (error) {
    console.error(`Error processing contact ${contact.name}:`, error);
    return { status: 'error', message: error.message, contact };
  }
}

// Link contact to project if not already linked
async function linkContactToProject(supabase: SupabaseClient, contactId: string, projectId: string): Promise<void> {
  // Check if contact is already linked to project
  const { data: existingLink, error: linkCheckError } = await supabase
    .from('project_contacts')
    .select('*')
    .eq('project_id', projectId)
    .eq('contact_id', contactId);
    
  if (linkCheckError) {
    console.error('Error checking existing project-contact link:', linkCheckError);
    throw new Error(`Error checking link: ${linkCheckError.message}`);
  } 
  
  // Only create the link if it doesn't already exist
  if (!existingLink || existingLink.length === 0) {
    console.log(`Linking contact ${contactId} to project ${projectId}`);
    const { error: linkError } = await supabase
      .from('project_contacts')
      .insert({
        project_id: projectId,
        contact_id: contactId
      });
      
    if (linkError) {
      console.error('Error linking contact to project:', linkError);
      throw new Error(`Error linking contact to project: ${linkError.message}`);
    }
  } else {
    console.log(`Contact ${contactId} already linked to project ${projectId}`);
  }
}
