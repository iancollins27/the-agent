
import { NormalizedCommunication } from "./types.ts";

export function parseJustCallWebhook(payload: any): NormalizedCommunication {
  console.log("Parsing JustCall webhook payload:", JSON.stringify(payload, null, 2));
  
  // Determine the type of webhook
  if (payload.type === "call" || payload.call_type) {
    return parseJustCallCallWebhook(payload);
  } else if (payload.type === "sms" || payload.message_type) {
    return parseJustCallSmsWebhook(payload);
  } else {
    console.error("Unknown JustCall webhook type. Full payload:", JSON.stringify(payload, null, 2));
    throw new Error(`Unknown JustCall webhook type. Payload keys: ${Object.keys(payload).join(', ')}`);
  }
}

function parseJustCallCallWebhook(payload: any): NormalizedCommunication {
  console.log("Parsing JustCall call webhook:", JSON.stringify(payload, null, 2));
  
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

function parseJustCallSmsWebhook(payload: any): NormalizedCommunication {
  console.log("Parsing JustCall SMS webhook:", JSON.stringify(payload, null, 2));
  
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
