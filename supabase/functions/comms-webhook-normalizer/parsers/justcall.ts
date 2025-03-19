
import { NormalizedCommunication } from "./types.ts";

export function parseJustCallWebhook(payload: any): NormalizedCommunication {
  // Determine the type of webhook
  if (payload.type === "call" || payload.call_type) {
    return parseJustCallCallWebhook(payload);
  } else if (payload.type === "sms" || payload.message_type) {
    return parseJustCallSmsWebhook(payload);
  } else {
    throw new Error("Unknown JustCall webhook type");
  }
}

function parseJustCallCallWebhook(payload: any): NormalizedCommunication {
  const isInbound = payload.direction === "inbound" || payload.call_type === "inbound";
  
  // Extract participants
  const participants = [];
  
  if (payload.from) {
    participants.push({
      type: 'phone',
      value: payload.from,
      role: isInbound ? 'caller' : 'recipient'
    });
  }
  
  if (payload.to) {
    participants.push({
      type: 'phone',
      value: payload.to,
      role: isInbound ? 'recipient' : 'caller'
    });
  }
  
  // Call status mapping to subtypes
  let subtype = 'CALL_OTHER';
  if (payload.status) {
    switch (payload.status.toLowerCase()) {
      case 'completed':
        subtype = 'CALL_COMPLETED';
        break;
      case 'missed':
        subtype = 'CALL_MISSED';
        break;
      case 'no-answer':
        subtype = 'CALL_NO_ANSWER';
        break;
      case 'busy':
        subtype = 'CALL_BUSY';
        break;
      case 'canceled':
        subtype = 'CALL_CANCELED';
        break;
      case 'failed':
        subtype = 'CALL_FAILED';
        break;
    }
  }
  
  // Get timestamp
  const timestamp = payload.timestamp || payload.start_time || new Date().toISOString();
  
  // Build normalized data
  return {
    type: 'CALL',
    subtype: subtype,
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    duration: payload.duration ? parseInt(payload.duration) : undefined,
    content: payload.notes || payload.transcript || undefined,
    recording_url: payload.recording_url || undefined
  };
}

function parseJustCallSmsWebhook(payload: any): NormalizedCommunication {
  const isInbound = payload.direction === "inbound" || payload.message_type === "inbound";
  
  // Extract participants
  const participants = [];
  
  if (payload.from) {
    participants.push({
      type: 'phone',
      value: payload.from,
      role: isInbound ? 'sender' : 'receiver'
    });
  }
  
  if (payload.to) {
    participants.push({
      type: 'phone',
      value: payload.to,
      role: isInbound ? 'receiver' : 'sender'
    });
  }
  
  // Get timestamp
  const timestamp = payload.timestamp || payload.date || new Date().toISOString();
  
  // Build normalized data
  return {
    type: 'SMS',
    subtype: 'SMS_MESSAGE',
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    content: payload.text || payload.body || payload.message || undefined
  };
}
