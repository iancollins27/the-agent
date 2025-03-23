
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
  }
  
  // Add content (message body or transcript)
  if (contextData.communication_content) {
    formattedData += `\nContent:\n${contextData.communication_content}\n`;
  }
  
  // Add recording URL if available
  if (contextData.communication_recording_url) {
    formattedData += `\nRecording URL: ${contextData.communication_recording_url}\n`;
  }
  
  return formattedData;
}
