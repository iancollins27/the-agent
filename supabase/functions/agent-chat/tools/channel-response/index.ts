
import { getToolDefinitions } from "../../tools/toolRegistry.ts";
import { supabase } from "../../supabase.ts";

/**
 * Tool for responding to users through their preferred channel
 */
export const channelResponseTool = {
  name: 'channel_response',
  description: 'Send responses to users via their preferred channel (web, SMS, email)',
  schema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'The ID of the session to send the response to'
      },
      message: {
        type: 'string',
        description: 'The message content to send'
      },
      project_id: {
        type: 'string',
        description: 'Optional project ID to associate with the message'
      }
    },
    required: ['session_id', 'message']
  },
  execute: async (args: any, context: any) => {
    const { session_id, message, project_id } = args;

    try {
      if (!session_id) {
        return {
          status: 'error',
          error: 'Missing session_id',
          message: 'session_id is required'
        };
      }

      if (!message) {
        return {
          status: 'error',
          error: 'Missing message',
          message: 'message content is required'
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
            message: 'You do not have permission to respond to this session'
          };
        }
      }

      // Call the send-channel-message function to deliver the response
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-channel-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
        },
        body: JSON.stringify({
          session_id,
          message,
          project_id
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error sending channel message:', errorText);
        return {
          status: 'error',
          error: `Failed to send message: ${response.status}`,
          message: 'Could not deliver message to recipient'
        };
      }
      
      const result = await response.json();
      
      return {
        status: 'success',
        channel_type: result.channel_type,
        communication_id: result.communication_id,
        message: `Message sent successfully via ${result.channel_type}`
      };
    } catch (error) {
      console.error('Error in channel_response tool:', error);
      return {
        status: 'error',
        error: error.message,
        message: 'Failed to send channel response'
      };
    }
  }
};
