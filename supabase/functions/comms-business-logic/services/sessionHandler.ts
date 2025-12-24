
/**
 * Session handling service for communications
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

interface SessionContext {
  sessionId: string;
  channelType: string;
  channelIdentifier: string;
  contactId?: string;
  companyId: string;
  projectId?: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export async function getSessionContext(
  supabase: ReturnType<typeof createClient>,
  communicationId: string
): Promise<SessionContext | null> {
  try {
    // Get the communication details
    const { data: comm, error: commError } = await supabase
      .from('communications')
      .select('id, type, content, session_id, project_id, company_id, direction, participants')
      .eq('id', communicationId)
      .single();
      
    if (commError || !comm) {
      console.error('Error fetching communication:', commError);
      return null;
    }

    // If session_id is already set, get the session
    if (comm.session_id) {
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', comm.session_id)
        .single();
        
      if (sessionError || !session) {
        console.error('Error fetching session:', sessionError);
        return null;
      }
      
      return {
        sessionId: session.id,
        channelType: session.channel_type,
        channelIdentifier: session.channel_identifier,
        contactId: session.contact_id,
        companyId: session.company_id,
        projectId: session.project_id,
        conversationHistory: session.conversation_history || []
      };
    }
    
    // No session yet - determine what type of channel this is
    let channelType: string;
    let channelIdentifier: string;
    let contactId: string | undefined;
    
    switch (comm.type) {
      case 'SMS':
        channelType = 'sms';
        // Extract phone number from participants
        const participant = (comm.participants || []).find(p => p.type === (comm.direction === 'INBOUND' ? 'sender' : 'recipient'));
        channelIdentifier = participant?.phone || '';
        contactId = participant?.contact_id;
        break;
      
      case 'EMAIL':
        channelType = 'email';
        // Extract email from participants
        const emailParticipant = (comm.participants || []).find(p => p.type === (comm.direction === 'INBOUND' ? 'sender' : 'recipient'));
        channelIdentifier = emailParticipant?.email || '';
        contactId = emailParticipant?.contact_id;
        break;
        
      default:
        console.error('Unsupported communication type for session:', comm.type);
        return null;
    }
    
    if (!channelIdentifier) {
      console.error('Could not determine channel identifier for session');
      return null;
    }
    
    // Create a new session via the session manager edge function
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/tool-session-manager`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""}`,
      },
      body: JSON.stringify({
        channel_type: channelType,
        channel_identifier: channelIdentifier,
        contact_id: contactId,
        company_id: comm.company_id,
        project_id: comm.project_id,
        communication_id: comm.id,
        memory_mode: 'standard',
      })
    });
    
    if (!response.ok) {
      console.error('Error creating session:', await response.text());
      return null;
    }
    
    const result = await response.json();
    
    if (!result.session) {
      console.error('No session returned from session manager');
      return null;
    }
    
    return {
      sessionId: result.session.id,
      channelType: result.session.channel_type,
      channelIdentifier: result.session.channel_identifier,
      contactId: result.session.contact_id,
      companyId: result.session.company_id,
      projectId: result.session.project_id,
      conversationHistory: result.session.conversation_history || []
    };
  } catch (error) {
    console.error('Error in getSessionContext:', error);
    return null;
  }
}

export async function updateSessionHistory(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  message: {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }
): Promise<boolean> {
  try {
    // First get current conversation history
    const { data: session, error: fetchError } = await supabase
      .from('chat_sessions')
      .select('conversation_history')
      .eq('id', sessionId)
      .single();
      
    if (fetchError) {
      console.error('Error fetching session history:', fetchError);
      return false;
    }
    
    // Add the new message
    const history = session.conversation_history || [];
    
    // Add timestamp if not provided
    const completeMessage = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };
    
    history.push(completeMessage);
    
    // Update the session
    const { error: updateError } = await supabase
      .from('chat_sessions')
      .update({
        conversation_history: history,
        last_activity: new Date().toISOString()
      })
      .eq('id', sessionId);
      
    if (updateError) {
      console.error('Error updating session history:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in updateSessionHistory:', error);
    return false;
  }
}

export async function markCommunicationProcessed(
  supabase: ReturnType<typeof createClient>,
  communicationId: string,
  sessionId?: string
): Promise<boolean> {
  try {
    const updates: Record<string, any> = { processed_by_agent: true };
    
    // If sessionId provided, update that as well
    if (sessionId) {
      updates.session_id = sessionId;
    }
    
    const { error } = await supabase
      .from('communications')
      .update(updates)
      .eq('id', communicationId);
      
    if (error) {
      console.error('Error marking communication as processed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in markCommunicationProcessed:', error);
    return false;
  }
}
