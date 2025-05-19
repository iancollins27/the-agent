
import { getToolDefinitions } from "../../tools/toolRegistry.ts";
import { supabase } from "../../supabase.ts";

/**
 * Tool for managing chat sessions across different channels
 */
export const sessionManagerTool = {
  name: 'session_manager',
  description: 'Manage chat sessions across channels (web, SMS, email), store and retrieve conversation history',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'update', 'create', 'find'],
        description: 'The action to perform on the session'
      },
      session_id: {
        type: 'string',
        description: 'The ID of the session to get or update'
      },
      company_id: {
        type: 'string',
        description: 'The company ID for the session'
      },
      project_id: {
        type: 'string',
        description: 'The project ID associated with the session'
      },
      channel_type: {
        type: 'string',
        enum: ['web', 'sms', 'email'],
        description: 'The type of channel for this session'
      },
      channel_identifier: {
        type: 'string',
        description: 'The identifier for this channel (phone number, email address)'
      },
      contact_id: {
        type: 'string',
        description: 'The contact ID associated with this session'
      },
      memory_mode: {
        type: 'string',
        enum: ['standard', 'detailed'],
        description: 'The memory mode for this session'
      },
      communication_id: {
        type: 'string',
        description: 'A communication ID to link to this session'
      }
    },
    required: ['action']
  },
  execute: async (args: any, context: any) => {
    const { action } = args;

    try {
      switch (action) {
        case 'get':
          return await getSession(args.session_id, context);
        
        case 'update':
          return await updateSession(args, context);
        
        case 'create':
          return await createSession(args, context);
          
        case 'find':
          return await findSession(args, context);
          
        default:
          return {
            status: 'error',
            error: `Unknown action: ${action}`,
            message: 'Supported actions are: get, update, create, find'
          };
      }
    } catch (error) {
      console.error(`Error in session_manager tool (${action}):`, error);
      return {
        status: 'error',
        error: error.message,
        message: `Session ${action} operation failed`
      };
    }
  }
};

// Helper functions for session operations
async function getSession(sessionId: string, context: any) {
  if (!sessionId) {
    return {
      status: 'error',
      error: 'Missing session_id',
      message: 'session_id is required for get operation'
    };
  }

  // Verify company access if needed
  if (context.companyId) {
    const { data: sessionCheck, error: checkError } = await supabase
      .from('chat_sessions')
      .select('company_id')
      .eq('id', sessionId)
      .single();
      
    if (checkError) {
      return {
        status: 'error',
        error: checkError.message,
        message: 'Session not found'
      };
    }
    
    if (sessionCheck.company_id !== context.companyId) {
      return {
        status: 'error',
        error: 'Access denied',
        message: 'You do not have permission to access this session'
      };
    }
  }

  const { data: session, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
    
  if (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to retrieve session'
    };
  }
  
  return {
    status: 'success',
    session
  };
}

async function updateSession(args: any, context: any) {
  const { session_id, project_id, contact_id, memory_mode } = args;
  
  if (!session_id) {
    return {
      status: 'error',
      error: 'Missing session_id',
      message: 'session_id is required for update operation'
    };
  }
  
  // Verify company access if needed
  if (context.companyId) {
    const { data: sessionCheck, error: checkError } = await supabase
      .from('chat_sessions')
      .select('company_id')
      .eq('id', session_id)
      .single();
      
    if (checkError) {
      return {
        status: 'error',
        error: checkError.message,
        message: 'Session not found'
      };
    }
    
    if (sessionCheck.company_id !== context.companyId) {
      return {
        status: 'error',
        error: 'Access denied',
        message: 'You do not have permission to update this session'
      };
    }
  }
  
  // Build update object with only provided fields
  const updates: Record<string, any> = {};
  if (project_id !== undefined) updates.project_id = project_id;
  if (contact_id !== undefined) updates.contact_id = contact_id;
  if (memory_mode !== undefined) updates.memory_mode = memory_mode;
  
  // Always update last_activity
  updates.last_activity = new Date().toISOString();
  
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .update(updates)
    .eq('id', session_id)
    .select()
    .single();
    
  if (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to update session'
    };
  }
  
  return {
    status: 'success',
    session,
    message: 'Session updated successfully'
  };
}

async function createSession(args: any, context: any) {
  const { channel_type, channel_identifier, contact_id, company_id, project_id, memory_mode } = args;
  
  // Validate required fields
  if (!channel_type || !channel_identifier || !company_id) {
    return {
      status: 'error',
      error: 'Missing required fields',
      message: 'channel_type, channel_identifier, and company_id are required'
    };
  }
  
  // If company ID is provided in context, verify it matches
  if (context.companyId && context.companyId !== company_id) {
    return {
      status: 'error',
      error: 'Company mismatch',
      message: 'You can only create sessions for your own company'
    };
  }
  
  // Set expiry based on channel type
  let expiryInterval = '24 hours';
  if (channel_type === 'email') {
    expiryInterval = '7 days';
  } else if (channel_type === 'web') {
    expiryInterval = '1 hour';
  }

  // Insert the new session
  const { data: session, error } = await supabase
    .from('chat_sessions')
    .insert({
      channel_type,
      channel_identifier,
      contact_id: contact_id || null,
      company_id,
      project_id: project_id || null,
      memory_mode: memory_mode || 'standard',
      expires_at: new Date(Date.now() + (channel_type === 'email' ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();
    
  if (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to create session'
    };
  }
  
  // Link communication if provided
  if (args.communication_id) {
    const { error: updateError } = await supabase
      .from('communications')
      .update({ session_id: session.id })
      .eq('id', args.communication_id);
      
    if (updateError) {
      console.error('Error linking communication to session:', updateError);
      // Continue despite error - the session is still created
    }
  }
  
  return {
    status: 'success',
    session,
    message: 'Session created successfully'
  };
}

async function findSession(args: any, context: any) {
  const { channel_type, channel_identifier, company_id } = args;
  
  // Validate required fields
  if (!channel_type || !channel_identifier) {
    return {
      status: 'error',
      error: 'Missing required fields',
      message: 'channel_type and channel_identifier are required'
    };
  }
  
  // If company ID is provided in context, use it for filtering
  const companyFilter = context.companyId || company_id;
  if (!companyFilter) {
    return {
      status: 'error',
      error: 'Missing company_id',
      message: 'company_id is required for finding sessions'
    };
  }
  
  // Find active sessions matching the criteria
  const { data: sessions, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('channel_type', channel_type)
    .eq('channel_identifier', channel_identifier)
    .eq('company_id', companyFilter)
    .eq('active', true)
    .gt('expires_at', new Date().toISOString())
    .order('last_activity', { ascending: false });
    
  if (error) {
    return {
      status: 'error',
      error: error.message,
      message: 'Failed to find sessions'
    };
  }
  
  return {
    status: 'success',
    sessions,
    count: sessions.length,
    message: sessions.length > 0 ? 'Active sessions found' : 'No active sessions found'
  };
}
