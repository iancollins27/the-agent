
/**
 * Utility for testing webhook requests with different content types
 */

/**
 * Test sending a webhook with JSON content type
 * @param data The data to send
 * @returns Response from the webhook diagnostic function
 */
export async function testWebhookWithJson(data: any): Promise<any> {
  console.log("Testing webhook with JSON payload:", data);
  
  try {
    const response = await fetch(
      "https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/webhook-diagnostic", 
      {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log("Webhook test result:", result);
    return result;
  } catch (error) {
    console.error("Webhook test failed:", error);
    throw error;
  }
}

/**
 * Test sending a webhook with form URL encoded content type
 * @param data The data to send as form fields
 * @returns Response from the webhook diagnostic function
 */
export async function testWebhookWithFormData(data: Record<string, string>): Promise<any> {
  console.log("Testing webhook with form data payload:", data);
  
  // Convert object to URLSearchParams
  const formBody = new URLSearchParams();
  Object.entries(data).forEach(([key, value]) => {
    formBody.append(key, value);
  });
  
  try {
    const response = await fetch(
      "https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/webhook-diagnostic", 
      {
        method: "POST",
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log("Webhook test result:", result);
    return result;
  } catch (error) {
    console.error("Webhook test failed:", error);
    throw error;
  }
}

/**
 * Test sending a webhook with a raw string body
 * @param content The raw string content to send
 * @param contentType The content type header to set
 * @returns Response from the webhook diagnostic function
 */
export async function testWebhookWithRawContent(content: string, contentType: string): Promise<any> {
  console.log(`Testing webhook with raw ${contentType} content:`, content);
  
  try {
    const response = await fetch(
      "https://lvifsxsrbluehopamqpy.supabase.co/functions/v1/webhook-diagnostic", 
      {
        method: "POST",
        headers: {
          'Content-Type': contentType,
        },
        body: content,
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log("Webhook test result:", result);
    return result;
  } catch (error) {
    console.error("Webhook test failed:", error);
    throw error;
  }
}
