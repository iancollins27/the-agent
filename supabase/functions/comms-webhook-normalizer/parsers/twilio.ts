
import { NormalizedCommunication } from "./types.ts";

export function parseTwilioWebhook(payload: any): NormalizedCommunication {
  console.log('Parsing Twilio webhook payload:', JSON.stringify(payload, null, 2).substring(0, 1000));
  
  try {
    // Determine the type of webhook
    if (payload.CallSid || payload.CallStatus) {
      return parseTwilioCallWebhook(payload);
    } else if (payload.MessageSid || payload.SmsSid || payload.Body) {
      return parseTwilioSmsWebhook(payload);
    } else {
      throw new Error("Unknown Twilio webhook type: " + JSON.stringify(payload).substring(0, 200));
    }
  } catch (error) {
    console.error('Error in Twilio parser:', error);
    // Always return a valid normalized communication structure even in error cases
    // This prevents downstream 500/503 errors and allows for better error tracking
    return {
      type: payload.CallSid ? 'CALL' : 'SMS',
      subtype: payload.CallSid ? 'CALL_OTHER' : 'SMS_MESSAGE',
      participants: parseParticipants(payload),
      timestamp: new Date().toISOString(),
      direction: determineDirection(payload),
      content: payload.Body || 'Error parsing webhook: ' + error.message,
      error_details: error.message
    };
  }
}

function parseParticipants(payload: any) {
  const participants = [];
  const isInbound = determineDirection(payload) === 'inbound';
  
  if (payload.From) {
    participants.push({
      type: 'phone',
      value: payload.From,
      role: isInbound ? (payload.CallSid ? 'caller' : 'sender') : (payload.CallSid ? 'recipient' : 'receiver')
    });
  }
  
  if (payload.To) {
    participants.push({
      type: 'phone',
      value: payload.To,
      role: isInbound ? (payload.CallSid ? 'recipient' : 'receiver') : (payload.CallSid ? 'caller' : 'sender')
    });
  }
  
  return participants;
}

function determineDirection(payload: any) {
  return payload.Direction === "inbound" || 
         payload.direction === "inbound" ? 
         'inbound' : 'outbound';
}

function parseTwilioCallWebhook(payload: any): NormalizedCommunication {
  console.log('Parsing Twilio call webhook');
  const isInbound = payload.Direction === "inbound";
  
  // Extract participants
  const participants = [];
  
  if (payload.From) {
    participants.push({
      type: 'phone',
      value: payload.From,
      role: isInbound ? 'caller' : 'recipient'
    });
  }
  
  if (payload.To) {
    participants.push({
      type: 'phone',
      value: payload.To,
      role: isInbound ? 'recipient' : 'caller'
    });
  }
  
  console.log('Extracted participants:', participants);
  
  // Call status mapping to subtypes
  let subtype = 'CALL_OTHER';
  if (payload.CallStatus) {
    switch (payload.CallStatus.toLowerCase()) {
      case 'completed':
        subtype = 'CALL_COMPLETED';
        break;
      case 'no-answer':
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
  
  // Convert Twilio's timestamp
  let timestamp = new Date().toISOString();
  if (payload.Timestamp) {
    try {
      timestamp = new Date(payload.Timestamp).toISOString();
    } catch (e) {
      console.error('Error parsing Twilio timestamp:', e);
    }
  }
  
  // Build normalized data
  return {
    type: 'CALL',
    subtype: subtype,
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    duration: payload.CallDuration ? parseInt(payload.CallDuration) : undefined,
    content: payload.TranscriptionText || undefined,
    recording_url: payload.RecordingUrl || undefined
  };
}

function parseTwilioSmsWebhook(payload: any): NormalizedCommunication {
  console.log('Parsing Twilio SMS webhook');
  const isInbound = payload.Direction === "inbound";
  
  // Extract participants
  const participants = [];
  
  if (payload.From) {
    participants.push({
      type: 'phone',
      value: payload.From,
      role: isInbound ? 'sender' : 'receiver'
    });
  }
  
  if (payload.To) {
    participants.push({
      type: 'phone',
      value: payload.To,
      role: isInbound ? 'receiver' : 'sender'
    });
  }
  
  console.log('Extracted participants:', participants);
  
  // Convert Twilio's timestamp
  let timestamp = new Date().toISOString();
  if (payload.DateCreated) {
    try {
      timestamp = new Date(payload.DateCreated).toISOString();
    } catch (e) {
      console.error('Error parsing Twilio timestamp:', e);
    }
  }
  
  // Build normalized data
  return {
    type: 'SMS',
    subtype: 'SMS_MESSAGE',
    participants: participants,
    timestamp: timestamp,
    direction: isInbound ? 'inbound' : 'outbound',
    content: payload.Body || undefined
  };
}
