
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// These CORS headers are essential for the webhook to work properly
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("==== WEBHOOK DIAGNOSTIC FUNCTION ====");
  console.log(`Request received at ${new Date().toISOString()}`);
  
  // Log all headers
  console.log("Headers:");
  const headers = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
    console.log(`  ${key}: ${value}`);
  });

  // Clone the request to be able to read the body multiple times
  const clonedReq = req.clone();
  
  // Try to get the raw text
  let rawText;
  try {
    rawText = await clonedReq.text();
    console.log("Raw body length:", rawText?.length || 0);
    console.log("Raw body content:", rawText);
  } catch (textError) {
    console.error("Error getting raw text:", textError);
  }

  // Try to parse as JSON
  let jsonBody = null;
  if (rawText && rawText.trim()) {
    try {
      jsonBody = JSON.parse(rawText);
      console.log("Successfully parsed JSON:", jsonBody);
    } catch (jsonError) {
      console.log("Not valid JSON:", jsonError.message);
      
      // Try to parse as form data if it's not JSON
      if (req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
        try {
          const formData = new URLSearchParams(rawText);
          jsonBody = Object.fromEntries(formData.entries());
          console.log("Parsed as form data:", jsonBody);
        } catch (formError) {
          console.error("Also not valid form data:", formError);
        }
      }
    }
  } else {
    console.log("Body is empty or only whitespace");
  }

  // Build a comprehensive response to help debug
  const diagnosticInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: headers,
    contentType: req.headers.get('content-type'),
    bodyLength: rawText?.length || 0,
    bodyContent: rawText || null,
    parsedBody: jsonBody,
    parseSuccessful: !!jsonBody,
  };

  console.log("Diagnostic complete. Returning information.");

  // Return detailed information to the caller
  return new Response(
    JSON.stringify(diagnosticInfo, null, 2),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
});
