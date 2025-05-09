// Keep whatever imports or dependencies you have at the top
import { Contact } from './types.ts';

export async function getProjectByCrmId(supabase, crmId: string) {
  console.log(`Looking up project with CRM ID: ${crmId}`);
  
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('crm_id', crmId)
    .single();
  
  if (error) {
    console.error('Error fetching project:', error);
    throw new Error(`Project not found with CRM ID: ${crmId}`);
  }
  
  console.log(`Found project: ${project.id} (${project.project_name || 'unnamed'})`);
  return project;
}

export async function processContact(supabase, contact: Contact, projectId: string) {
  try {
    console.log(`Processing contact: ${JSON.stringify(contact)}`);
    
    // Validate contact data
    if (!contact.name) {
      return { 
        status: 'error', 
        message: 'Contact name is required',
        contactId: null
      };
    }
    
    // Role is already normalized in the main function using normalizeRole
    // that fetches valid values from the database enum
    
    // Check if contact already exists
    let existingContact = null;
    
    // First try to find by phone if provided
    if (contact.phone) {
      const { data: phoneMatch } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone_number', contact.phone)
        .limit(1);
      
      if (phoneMatch && phoneMatch.length > 0) {
        existingContact = phoneMatch[0];
        console.log(`Found existing contact by phone: ${existingContact.id}`);
      }
    }
    
    // If no match by phone, try by email
    if (!existingContact && contact.email) {
      const { data: emailMatch } = await supabase
        .from('contacts')
        .select('*')
        .eq('email', contact.email)
        .limit(1);
      
      if (emailMatch && emailMatch.length > 0) {
        existingContact = emailMatch[0];
        console.log(`Found existing contact by email: ${existingContact.id}`);
      }
    }
    
    // If no match by phone or email, try by name and role
    if (!existingContact) {
      const { data: nameMatch } = await supabase
        .from('contacts')
        .select('*')
        .eq('full_name', contact.name)
        .eq('role', contact.role || 'HO')
        .limit(1);
      
      if (nameMatch && nameMatch.length > 0) {
        existingContact = nameMatch[0];
        console.log(`Found existing contact by name and role: ${existingContact.id}`);
      }
    }
    
    let contactId;
    
    // Update existing contact or create new one
    if (existingContact) {
      // Update existing contact with any new information
      const updates = {};
      
      if (contact.email && !existingContact.email) updates.email = contact.email;
      if (contact.phone && !existingContact.phone_number) updates.phone_number = contact.phone;
      if (contact.role && existingContact.role === 'HO') updates.role = contact.role;
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', existingContact.id);
        
        if (updateError) {
          console.error('Error updating contact:', updateError);
        } else {
          console.log(`Updated contact ${existingContact.id} with new info:`, updates);
        }
      }
      
      contactId = existingContact.id;
    } else {
      // Create new contact
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          full_name: contact.name,
          email: contact.email || null,
          phone_number: contact.phone || null,
          role: contact.role || 'HO'
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Error creating contact:', insertError);
        throw new Error(`Failed to create contact: ${insertError.message}`);
      }
      
      console.log(`Created new contact: ${newContact.id}`);
      contactId = newContact.id;
    }
    
    // Associate contact with project if not already associated
    const { data: existingAssociation } = await supabase
      .from('project_contacts')
      .select('*')
      .eq('project_id', projectId)
      .eq('contact_id', contactId);
    
    if (!existingAssociation || existingAssociation.length === 0) {
      const { error: associationError } = await supabase
        .from('project_contacts')
        .insert({
          project_id: projectId,
          contact_id: contactId
        });
      
      if (associationError) {
        console.error('Error associating contact with project:', associationError);
        throw new Error(`Failed to associate contact with project: ${associationError.message}`);
      }
      
      console.log(`Associated contact ${contactId} with project ${projectId}`);
    } else {
      console.log(`Contact ${contactId} already associated with project ${projectId}`);
    }
    
    return {
      status: 'success',
      message: existingContact ? 'Contact updated' : 'Contact created',
      contactId
    };
  } catch (error) {
    console.error(`Error processing contact ${contact.name}:`, error);
    return {
      status: 'error',
      message: error.message,
      contactId: null
    };
  }
}
