
/**
 * Utility functions for formatting data
 */

/**
 * Formats phone numbers consistently for comparison
 * @param phoneNumber The phone number to format
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle international format (e.g., +1234567890)
  // If it doesn't start with country code, we'll assume it's a US number
  if (cleaned.length === 10) {
    // Add US country code if it's a 10-digit number
    cleaned = '1' + cleaned;
  } else if (cleaned.length > 10 && cleaned.startsWith('1')) {
    // Already has country code
    cleaned = cleaned;
  }
  
  return cleaned;
}
