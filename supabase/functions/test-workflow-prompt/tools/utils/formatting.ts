
/**
 * Formatting utilities for tools
 */

/**
 * Formats a message for consistency and clarity
 */
export function formatMessage(message: string): string {
  if (!message) return '';
  
  // Trim whitespace and ensure proper ending punctuation
  let formatted = message.trim();
  
  // Ensure message ends with proper punctuation
  const endPunctuation = ['.', '!', '?'];
  if (!endPunctuation.some(p => formatted.endsWith(p))) {
    formatted += '.';
  }
  
  return formatted;
}

/**
 * Extracts the most relevant content from various message fields
 */
export function extractMessageContent(data: any): string | null {
  // Check various possible locations for message content
  if (typeof data === 'string') {
    return data;
  }
  
  if (!data) return null;
  
  // Try top-level fields
  for (const field of ['message_text', 'message', 'message_content', 'content']) {
    if (data[field]) return data[field];
  }
  
  // Try in action_payload
  if (data.action_payload) {
    for (const field of ['message_text', 'message', 'message_content', 'content']) {
      if (data.action_payload[field]) return data.action_payload[field];
    }
  }
  
  return null;
}
