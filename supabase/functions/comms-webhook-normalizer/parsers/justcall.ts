
import { NormalizedCommunication } from "./types.ts";

export function parseJustCallWebhook(payload: any): NormalizedCommunication {
  console.log("Parsing JustCall webhook payload:", JSON.stringify(payload, null, 2));
  
  try {
    // The new JustCall webhook format has a 'type' field with dot notation (e.g., 'call.completed')
    // and the actual data is nested under 'data'
    if (payload.type && payload.type.includes('.') && payload.data) {
      const [eventCategory, eventAction] = payload.type.split('.');
      
      if (eventCategory === 'call') {
        return parseNewJustCallCallWebhook(payload.data, eventAction);
      } else if (eventCategory === 'sms') {
        return parseNewJustCallSmsWebhook(payload.data);
      }
    }
    
    // Fall back to the old format
    if (payload.type === "call" || payload.call_type) {
      return parseJustCallCallWebhook(payload);
    } else if (payload.type === "sms" || payload.message_type) {
      return parseJustCallSmsWebhook(payload);
    } else {
      console.error("Unknown JustCall webhook type. Full payload:", JSON.stringify(payload, null, 2));
      throw new Error(`Unknown JustCall webhook type. Payload keys: ${Object.keys(payload).join(', ')}`);
    }
  } catch (error) {
    console.error("Error parsing JustCall webhook:", error);
    throw error;
  }
}

// Handler for new JustCall call webhooks (call.completed, call.initiated, call.incoming, call.missed)
function parseNewJustCallCallWebhook(data: any, eventAction: string): NormalizedCommunication {
  console.log(`Parsing new JustCall ${eventAction} call webhook:`, JSON.stringify(data, null, 2));

  // Extract the direction
  const callInfo = data.call_info || {};
  const isInbound = callInfo.direction ? 
    callInfo.direction.toLowerCase() === "incoming" : true;

  // Extract participants
  const participants = [];
  
  try {
    // From participant (caller for inbound, agent for outbound)
    if (isInbound) {
      // For inbound calls, the caller is the contact
      if (data.contact_number) {
        participants.push({
          type: 'phone',
          value: String(data.contact_number),
          role: 'caller'
        });
      }
      
      // The recipient is the agent/justcall number
      if (data.justcall_number) {
        participants.push({
          type: 'phone',
          value: String(data.justcall_number),
          role: 'recipient'
        });
      }
    } else {
      // For outbound calls, the caller is the agent
      if (data.justcall_number) {
        participants.push({
          type: 'phone',
          value: String(data.justcall_number),
          role: 'caller'
        });
      }
      
      // The recipient is the contact
      if (data.contact_number) {
        participants.push({
          type: 'phone',
          value: String(data.contact_number),
          role: 'recipient'
        });
      }
    }
    
    // Add agent email if available
    if (data.agent_email) {
      participants.push({
        type: 'email',
        value: String(data.agent_email),
        role: isInbound ? 'recipient' : 'caller'
      });
    }

    // Add contact email if available
    if (data.contact_email) {
      participants.push({
        type: 'email',
        value: String(data.contact_email),
        role: isInbound ? 'caller' : 'recipient'
      });
    }
  } catch (error) {
    console.error("Error parsing participants:", error);
    // Add fallback participants
    participants.push({
      type: 'phone',
      value: 'unknown',
      role: 'unknown'
    });
  }
  
  // Determine call subtype based on eventAction and call info
  let subtype = 'CALL_OTHER';
  try {
    switch (eventAction) {
      case 'completed':
        subtype = 'CALL_COMPLETED';
        break;
      case 'missed':
        subtype = 'CALL_MISSED';
        break;
      case 'initiated':
        subtype = 'CALL_INITIATED';
        break;
      case 'incoming':
        subtype = 'CALL_INCOMING';
        break;
      default:
        // Check call_info.type as fallback
        if (callInfo.type) {
          const callType = String(callInfo.type).toLowerCase();
          switch (callType) {
            case 'answered':
              subtype = 'CALL_COMPLETED';
              break;
            case 'missed':
              subtype = 'CALL_MISSED';
              break;
            case 'no-answer':
            case 'noanswer':
            case 'no_answer':
              subtype = 'CALL_NO_ANSWER';
              break;
            case 'busy':
              subtype = 'CALL_BUSY';
              break;
            case 'canceled':
            case 'cancelled':
              subtype = 'CALL_CANCELED';
              break;
            case 'failed':
              subtype = 'CALL_FAILED';
              break;
          }
        }
    }
  } catch (error) {
    console.error("Error determining call subtype:", error);
  }
  
  // Get timestamp with fallback
  let timestamp: string;
  try {
    // Construct a proper datetime string from date and time fields
    if (data.call_date && data.call_time) {
      timestamp = `${data.call_date} ${data.call_time}`;
    } else {
      timestamp = new Date().toISOString();
    }
    
    // Ensure it's in ISO format
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      timestamp = new Date(timestamp).toISOString();
    }
  } catch (error) {
    console.error("Error parsing timestamp:", error);
    timestamp = new Date().toISOString();
  }
  
  // Parse duration with fallback
  let duration: number | undefined;
  try {
    const callDuration = data.call_duration || {};
    
    // Try to get the total_duration first
    if (callDuration.total_duration && callDuration.total_duration !== null) {
      duration = Number(callDuration.total_duration);
    } 
    // Fall back to parsing the friendly_duration if available
    else if (callDuration.friendly_duration) {
      const durationParts = callDuration.friendly_duration.split(':');
      if (durationParts.length === 3) {
        const hours = parseInt(durationParts[0], 10);
        const minutes = parseInt(durationParts[1], 10);
        const seconds = parseInt(durationParts[2], 10);
        duration = (hours * 3600) + (minutes * 60) + seconds;
      }
    }
    
    // Safety check that duration is a valid number
    if (isNaN(duration as number)) {
      duration = undefined;
    }
  } catch (error) {
    console.error("Error parsing call duration:", error);
    duration = undefined;
  }
  
  // Get content (notes, transcription, etc.)
  let content: string | undefined;
  try {
    if (callInfo.notes) {
      content = callInfo.notes;
    } else if (data.justcall_ai && data.justcall_ai.call_summary) {
      content = data.justcall_ai.call_summary;
    } else if (data.justcall_ai && data.justcall_ai.call_transcription && data.justcall_ai.call_transcription.length > 0) {
      // For transcription array, join them into a string
      content = data.justcall_ai.call_transcription
        .map((item: any) => `${item.speaker || 'Unknown'}: ${item.text || ''}`)
        .join('\n');
    } else if (callInfo.voicemail_transcription) {
      content = callInfo.voicemail_transcription;
    }
  } catch (error) {
    console.error("Error parsing call content:", error);
  }
  
  // Get recording URL if available
  let recordingUrl: string | undefined;
  try {
    if (callInfo.recording) {
      recordingUrl = callInfo.recording;
    }
  } catch (error) {
    console.error("Error parsing recording URL:", error);
  }
  
  // Build normalized data
  const result: NormalizedCommunication = {
    type: 'CALL',
    subtype: subtype,
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    duration: duration,
    content: content,
    recording_url: recordingUrl
  };
  
  console.log("Normalized call data:", JSON.stringify(result, null, 2));
  return result;
}

// Parse the new JustCall SMS webhooks
function parseNewJustCallSmsWebhook(data: any): NormalizedCommunication {
  console.log("Parsing new JustCall SMS webhook:", JSON.stringify(data, null, 2));
  
  // Determine direction
  const isInbound = data.direction ? 
    data.direction.toLowerCase() === "incoming" : false;
  
  // Extract participants
  const participants = [];
  
  try {
    // For inbound SMS, the sender is the contact and receiver is the JustCall number
    // For outbound SMS, the sender is the JustCall number and receiver is the contact
    if (isInbound) {
      if (data.contact_number) {
        participants.push({
          type: 'phone',
          value: String(data.contact_number),
          role: 'sender'
        });
      }
      
      if (data.justcall_number) {
        participants.push({
          type: 'phone',
          value: String(data.justcall_number),
          role: 'receiver'
        });
      }
    } else {
      if (data.justcall_number) {
        participants.push({
          type: 'phone',
          value: String(data.justcall_number),
          role: 'sender'
        });
      }
      
      if (data.contact_number) {
        participants.push({
          type: 'phone',
          value: String(data.contact_number),
          role: 'receiver'
        });
      }
    }
    
    // Add agent email if available
    if (data.agent_email) {
      participants.push({
        type: 'email',
        value: String(data.agent_email),
        role: isInbound ? 'receiver' : 'sender'
      });
    }

    // Add contact email if available
    if (data.contact_email) {
      participants.push({
        type: 'email',
        value: String(data.contact_email),
        role: isInbound ? 'sender' : 'receiver'
      });
    }
  } catch (error) {
    console.error("Error parsing SMS participants:", error);
    // Add fallback participants
    participants.push({
      type: 'phone',
      value: 'unknown',
      role: 'unknown'
    });
  }
  
  // Get timestamp with fallback
  let timestamp: string;
  try {
    // Construct a proper datetime string from date and time fields
    if (data.sms_date && data.sms_time) {
      timestamp = `${data.sms_date} ${data.sms_time}`;
    } else {
      timestamp = new Date().toISOString();
    }
    
    // Ensure it's in ISO format
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      timestamp = new Date(timestamp).toISOString();
    }
  } catch (error) {
    console.error("Error parsing SMS timestamp:", error);
    timestamp = new Date().toISOString();
  }
  
  // Extract SMS body
  let content: string | undefined;
  try {
    if (data.sms_info && data.sms_info.body) {
      content = data.sms_info.body;
    }
  } catch (error) {
    console.error("Error parsing SMS content:", error);
  }
  
  // Build normalized data
  const result: NormalizedCommunication = {
    type: 'SMS',
    subtype: 'SMS_MESSAGE',
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    content: content
  };
  
  console.log("Normalized SMS data:", JSON.stringify(result, null, 2));
  return result;
}

// Handler for the original JustCall call webhooks (older format)
function parseJustCallCallWebhook(payload: any): NormalizedCommunication {
  console.log("Parsing JustCall call webhook (legacy format):", JSON.stringify(payload, null, 2));
  
  // Default to inbound if direction is not specified
  const isInbound = payload.direction ? 
    payload.direction.toLowerCase() === "inbound" : 
    payload.call_type ? payload.call_type.toLowerCase() === "inbound" : true;
  
  // Extract participants with better error handling
  const participants = [];
  
  try {
    if (payload.from) {
      participants.push({
        type: 'phone',
        value: String(payload.from),
        role: isInbound ? 'caller' : 'recipient'
      });
    }
    
    if (payload.to) {
      participants.push({
        type: 'phone',
        value: String(payload.to),
        role: isInbound ? 'recipient' : 'caller'
      });
    }
  } catch (error) {
    console.error("Error parsing participants:", error);
    // Add fallback participants
    participants.push({
      type: 'phone',
      value: 'unknown',
      role: 'unknown'
    });
  }
  
  // Call status mapping to subtypes with better error handling
  let subtype = 'CALL_OTHER';
  if (payload.status) {
    try {
      const status = String(payload.status).toLowerCase();
      switch (status) {
        case 'completed':
          subtype = 'CALL_COMPLETED';
          break;
        case 'missed':
          subtype = 'CALL_MISSED';
          break;
        case 'no-answer':
        case 'noanswer':
        case 'no_answer':
          subtype = 'CALL_NO_ANSWER';
          break;
        case 'busy':
          subtype = 'CALL_BUSY';
          break;
        case 'canceled':
        case 'cancelled':
          subtype = 'CALL_CANCELED';
          break;
        case 'failed':
          subtype = 'CALL_FAILED';
          break;
        default:
          console.log(`Unrecognized call status: ${status}, using CALL_OTHER`);
          break;
      }
    } catch (error) {
      console.error("Error parsing call status:", error);
    }
  }
  
  // Get timestamp with fallback
  let timestamp: string;
  try {
    timestamp = payload.timestamp || payload.start_time || new Date().toISOString();
    // Ensure it's in ISO format if it's a date string
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      timestamp = new Date(timestamp).toISOString();
    }
  } catch (error) {
    console.error("Error parsing timestamp:", error);
    timestamp = new Date().toISOString();
  }
  
  // Parse duration with fallback
  let duration: number | undefined;
  try {
    if (payload.duration) {
      const durationValue = parseInt(payload.duration);
      duration = isNaN(durationValue) ? undefined : durationValue;
    }
  } catch (error) {
    console.error("Error parsing duration:", error);
  }
  
  // Build normalized data
  const result: NormalizedCommunication = {
    type: 'CALL',
    subtype: subtype,
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    duration: duration,
    content: payload.notes || payload.transcript || undefined,
    recording_url: payload.recording_url || undefined
  };
  
  console.log("Normalized call data:", JSON.stringify(result, null, 2));
  return result;
}

// Handler for the original JustCall SMS webhooks (older format)
function parseJustCallSmsWebhook(payload: any): NormalizedCommunication {
  console.log("Parsing JustCall SMS webhook (legacy format):", JSON.stringify(payload, null, 2));
  
  // Default to inbound if direction is not specified
  const isInbound = payload.direction ? 
    payload.direction.toLowerCase() === "inbound" : 
    payload.message_type ? payload.message_type.toLowerCase() === "inbound" : true;
  
  // Extract participants with better error handling
  const participants = [];
  
  try {
    if (payload.from) {
      participants.push({
        type: 'phone',
        value: String(payload.from),
        role: isInbound ? 'sender' : 'receiver'
      });
    }
    
    if (payload.to) {
      participants.push({
        type: 'phone',
        value: String(payload.to),
        role: isInbound ? 'receiver' : 'sender'
      });
    }
  } catch (error) {
    console.error("Error parsing SMS participants:", error);
    // Add fallback participants
    participants.push({
      type: 'phone',
      value: 'unknown',
      role: 'unknown'
    });
  }
  
  // Get timestamp with fallback and better error handling
  let timestamp: string;
  try {
    timestamp = payload.timestamp || payload.date || new Date().toISOString();
    // Ensure it's in ISO format if it's a date string
    if (typeof timestamp === 'string' && timestamp.includes(' ') && !timestamp.includes('T')) {
      timestamp = new Date(timestamp).toISOString();
    }
  } catch (error) {
    console.error("Error parsing SMS timestamp:", error);
    timestamp = new Date().toISOString();
  }
  
  // Build normalized data
  const result: NormalizedCommunication = {
    type: 'SMS',
    subtype: 'SMS_MESSAGE',
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    content: payload.text || payload.body || payload.message || undefined
  };
  
  console.log("Normalized SMS data:", JSON.stringify(result, null, 2));
  return result;
}
