
/**
 * Format communication data into a structured string for better readability in prompts
 * @param contextData Communication context data
 * @returns Formatted string representation of the communication data
 */
export function formatCommunicationData(contextData: any): string {
  // Create a structured, readable format for the communication data
  let formattedData = "Communication Information:\n";
  
  // Add communication type
  formattedData += `Type: ${contextData.communication_type || 'Unknown'}\n`;
  
  // Add communication subtype
  if (contextData.communication_subtype) {
    formattedData += `Subtype: ${contextData.communication_subtype}\n`;
  }
  
  // Add direction
  if (contextData.communication_direction) {
    formattedData += `Direction: ${contextData.communication_direction}\n`;
  }
  
  // Add call status (missed, completed, etc.) based on subtype for calls
  if (contextData.communication_type === 'CALL' && contextData.communication_subtype) {
    const callSubtype = contextData.communication_subtype;
    if (callSubtype === 'CALL_MISSED') {
      formattedData += `Status: Missed Call\n`;
    } else if (callSubtype === 'CALL_COMPLETED') {
      formattedData += `Status: Completed Call\n`;
    } else if (callSubtype === 'CALL_NO_ANSWER') {
      formattedData += `Status: No Answer\n`;
    } else if (callSubtype === 'CALL_BUSY') {
      formattedData += `Status: Line Busy\n`;
    } else if (callSubtype === 'CALL_CANCELED') {
      formattedData += `Status: Call Canceled\n`;
    } else if (callSubtype === 'CALL_FAILED') {
      formattedData += `Status: Call Failed\n`;
    }
  }
  
  // Add participants information (from/to)
  if (contextData.communication_participants && Array.isArray(contextData.communication_participants)) {
    const participants = contextData.communication_participants;
    
    const callerOrSender = participants.find(p => p.role === 'caller' || p.role === 'sender');
    const recipientOrReceiver = participants.find(p => p.role === 'recipient' || p.role === 'receiver');
    
    if (callerOrSender) {
      formattedData += `From: ${callerOrSender.value} (${callerOrSender.type})\n`;
    }
    
    if (recipientOrReceiver) {
      formattedData += `To: ${recipientOrReceiver.value} (${recipientOrReceiver.type})\n`;
    }
    
    // If roles aren't specified, just list participants
    if (!callerOrSender && !recipientOrReceiver && participants.length > 0) {
      formattedData += `Participants: ${participants.map(p => `${p.value} (${p.type})`).join(', ')}\n`;
    }
  }
  
  // Add timestamp
  if (contextData.communication_timestamp) {
    // Format date to be more readable
    const date = new Date(contextData.communication_timestamp);
    formattedData += `Time: ${date.toLocaleString()}\n`;
  }
  
  // Add duration for calls
  if (contextData.communication_type === 'CALL' && contextData.communication_duration) {
    const minutes = Math.floor(contextData.communication_duration / 60);
    const seconds = contextData.communication_duration % 60;
    formattedData += `Duration: ${minutes}m ${seconds}s\n`;
  } else if (contextData.communication_type === 'CALL' && contextData.communication_subtype === 'CALL_MISSED') {
    formattedData += `Duration: 0s (Missed Call)\n`;
  }
  
  // Add content (message body or transcript)
  if (contextData.communication_content) {
    const contentPrefix = contextData.communication_type === 'CALL' ? 'Transcript' : 'Content';
    formattedData += `\n${contentPrefix}:\n${contextData.communication_content}\n`;
  }
  
  // Add recording URL if available
  if (contextData.communication_recording_url) {
    formattedData += `\nRecording URL: ${contextData.communication_recording_url}\n`;
  }
  
  return formattedData;
}
