/**
 * Create action record tool for agent-chat
 */
import { Tool, ToolContext, ToolResult } from '../types.ts';

// Schema for create_action_record
export const createActionRecordSchema = {
  type: "object",
  properties: {
    action_type: {
      type: "string",
      description: "Type of action to record (e.g., 'message', 'data_update', 'set_future_reminder')"
    },
    message: {
      type: "string",
      description: "Message content for message actions, or description for other action types"
    },
    recipient: {
      type: "string",
      description: "Name or role of the recipient for message actions"
    },
    recipient_id: {
      type: "string",
      description: "ID of the recipient for message actions (if available)"
    },
    sender: {
      type: "string",
      description: "Name or role of the sender for message actions"
    },
    sender_ID: {
      type: "string",
      description: "ID of the sender for message actions (if available)"
    },
    requires_approval: {
      type: "boolean",
      description: "Whether this action requires human approval before execution"
    },
    action_payload: {
      type: "object",
      description: "Additional data specific to the action type"
    },
    project_id: {
      type: "string",
      description: "The project ID associated with this action"
    }
  },
  required: ["action_type"]
};

// Function to find a contact by name, role or partial match
async function findContactById(supabase: any, contactId: string): Promise<any> {
  if (!contactId) return null;
  
  try {
    // First try direct ID lookup
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, role, email, phone_number')
      .eq('id', contactId)
      .single();
    
    if (!error && data) {
      console.log(`Found contact with ID ${contactId}: ${data.full_name} (${data.role})`);
      return data;
    }
    
    console.log(`No contact found with ID ${contactId}`);
    return null;
  } catch (error) {
    console.error(`Error finding contact by ID: ${error.message}`);
    return null;
  }
}

// Function to find a contact by name or role
async function findContactByNameOrRole(supabase: any, nameOrRole: string, projectId?: string): Promise<string | null> {
  if (!nameOrRole) return null;
  
  try {
    console.log(`Looking for contact "${nameOrRole}" ${projectId ? `in project ${projectId}` : ''}`);
    
    let contactsQuery = supabase
      .from('contacts')
      .select('id, full_name, role');
    
    // If we have a project ID, join with project_contacts to limit to contacts in the project
    if (projectId) {
      contactsQuery = supabase
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
    }
    
    const { data: allContacts, error } = await contactsQuery;
    
    if (error) {
      console.error(`Error querying contacts: ${error.message}`);
      return null;
    }
    
    if (!allContacts || allContacts.length === 0) {
      console.log("No contacts found in the database");
      return null;
    }
    
    // Process the results based on which query we ran
    const contacts = projectId 
      ? allContacts.map(row => row.contacts).filter(Boolean) 
      : allContacts;
    
    console.log(`Found ${contacts.length} total contacts to search through`);
    
    // Normalize search term
    const searchTerm = nameOrRole.toLowerCase().trim();
    
    // Common roles mapping (case-insensitive check)
    const roleMapping: Record<string, string[]> = {
      "homeowner": ["HO", "Homeowner", "Customer", "Client"],
      "pm": ["PM", "Project Manager", "BidList Project Manager"],
      "project manager": ["PM", "Project Manager", "BidList Project Manager"],
      "bidlist project manager": ["PM", "Project Manager", "BidList Project Manager"],
      "roofer": ["Roofer", "Roofing Contractor", "Roofing Company"],
      "solar": ["Solar", "Solar Rep", "Solar Ops", "Solar Representative"] 
    };
    
    // 1. First try exact name match
    const exactNameMatch = contacts.find(
      contact => contact.full_name.toLowerCase() === searchTerm
    );
    
    if (exactNameMatch) {
      console.log(`Found exact name match: ${exactNameMatch.full_name}`);
      return exactNameMatch.id;
    }
    
    // 2. Try exact role match
    const exactRoleMatch = contacts.find(
      contact => contact.role && contact.role.toLowerCase() === searchTerm
    );
    
    if (exactRoleMatch) {
      console.log(`Found exact role match: ${exactRoleMatch.role} (${exactRoleMatch.full_name})`);
      return exactRoleMatch.id;
    }
    
    // 3. Try role category match
    for (const [category, aliases] of Object.entries(roleMapping)) {
      if (aliases.some(alias => alias.toLowerCase() === searchTerm) || 
          category.toLowerCase() === searchTerm) {
        // Find contacts with matching role category
        const matchingContact = contacts.find(contact => {
          const contactRole = contact.role ? contact.role.toLowerCase() : '';
          return contactRole && (
            aliases.some(alias => alias.toLowerCase() === contactRole) ||
            contactRole.includes(category.toLowerCase())
          );
        });
        
        if (matchingContact) {
          console.log(`Found role category match: ${matchingContact.full_name} (${matchingContact.role})`);
          return matchingContact.id;
        }
      }
    }
    
    // 4. Try partial name match
    const partialNameMatch = contacts.find(
      contact => contact.full_name.toLowerCase().includes(searchTerm) || 
                searchTerm.includes(contact.full_name.toLowerCase())
    );
    
    if (partialNameMatch) {
      console.log(`Found partial name match: ${partialNameMatch.full_name}`);
      return partialNameMatch.id;
    }
    
    // 5. Try partial role match
    const partialRoleMatch = contacts.find(
      contact => contact.role && (
        contact.role.toLowerCase().includes(searchTerm) ||
        searchTerm.includes(contact.role.toLowerCase())
      )
    );
    
    if (partialRoleMatch) {
      console.log(`Found partial role match: ${partialRoleMatch.role} (${partialRoleMatch.full_name})`);
      return partialRoleMatch.id;
    }

    // 6. Try to match by email if the search term looks like an email
    if (searchTerm.includes('@')) {
      const emailMatch = contacts.find(
        contact => contact.email && contact.email.toLowerCase() === searchTerm
      );
      
      if (emailMatch) {
        console.log(`Found email match: ${emailMatch.email} (${emailMatch.full_name})`);
        return emailMatch.id;
      }
    }
    
    console.log(`No match found for "${nameOrRole}"`);
    return null;
    
  } catch (error) {
    console.error(`Error in findContactByNameOrRole: ${error.message}`);
    return null;
  }
}

// Execute function for create_action_record
async function execute(args: any, context: ToolContext): Promise<ToolResult> {
  const { supabase, userProfile, companyId } = context;
  
  try {
    // Extract user and project information from the context
    const userId = userProfile?.id; 
    const projectId = args.project_id;
    
    console.log(`Creating action record with args:`, JSON.stringify(args));

    // If we don't have a company ID, try to get it from the project
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && projectId) {
      try {
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('company_id')
          .eq('id', projectId)
          .single();

        if (projectData && !projectError) {
          resolvedCompanyId = projectData.company_id;
          console.log(`Resolved company ID from project: ${resolvedCompanyId}`);
        }
      } catch (err) {
        console.error(`Error resolving company ID from project: ${err.message}`);
      }
    }

    // Handle contact information
    let recipientId = args.recipient_id || null;
    let senderId = args.sender_ID || null;
    
    // If recipient is provided as name/role but not ID, try to find the contact
    if (args.recipient && !recipientId) {
      recipientId = await findContactByNameOrRole(supabase, args.recipient, projectId);
      console.log(`Resolved recipient "${args.recipient}" to ID: ${recipientId}`);
    }
    
    // If sender is provided as name/role but not ID, try to find the contact
    if (args.sender && !senderId) {
      senderId = await findContactByNameOrRole(supabase, args.sender, projectId);
      console.log(`Resolved sender "${args.sender}" to ID: ${senderId}`);
    }
    
    // Prepare action payload with resolved IDs
    let actionPayload = args.action_payload || {};
    
    // For message actions, ensure standard fields are in the payload
    if (args.action_type === 'message') {
      actionPayload = {
        ...actionPayload,
        message_content: args.message || actionPayload.message_content,
        recipient: args.recipient || actionPayload.recipient,
        recipient_id: recipientId || actionPayload.recipient_id,
        sender: args.sender || actionPayload.sender,
        sender_ID: senderId || actionPayload.sender_ID,
      };
    }

    // Prepare the action record data
    const actionData: Record<string, any> = {
      action_type: args.action_type,
      message: args.message || null,
      recipient_id: recipientId,
      sender_ID: senderId,
      requires_approval: args.requires_approval ?? true,
      action_payload: actionPayload,
      status: (args.requires_approval ?? true) ? 'pending' : 'approved',
      project_id: projectId,
      created_by: userId,
    };

    // Do NOT include company_id field at all even if we have it
    // The action_records table doesn't have this column
    
    console.log("Creating action record with data:", actionData);

    // Insert the action record
    const { data, error } = await supabase
      .from('action_records')
      .insert(actionData)
      .select()
      .single();

    if (error) {
      console.error("Error creating action record:", error);
      return {
        status: "error",
        error: error.message || "Failed to create action record"
      };
    }

    console.log("Action record created:", data);
    return {
      status: "success",
      action_record_id: data.id,
      message: `Created ${args.action_type} action record`
    };
  } catch (error) {
    console.error("Error in create_action_record tool:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}

// Export the tool definition
export const createActionRecord: Tool = {
  name: "create_action_record",
  description: "Creates an action record based on your analysis. Use this when you determine an action is needed (message, data update, or set a reminder).",
  schema: createActionRecordSchema,
  execute
};
