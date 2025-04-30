
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { handleRequest } from "./services/requestHandler.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

console.log("Starting test-workflow-prompt function, connecting to Supabase at:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request");
    return new Response(null, { 
      headers: corsHeaders,
      status: 200 // Explicitly set status code to 200 for OPTIONS
    });
  }
  
  try {
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Received request with body:", JSON.stringify(requestBody, null, 2).substring(0, 500) + "...");
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      throw new Error("Invalid JSON in request body");
    }
    
    console.log("Processing request through handleRequest");
    const response = await handleRequest(supabase, requestBody);
    
    // Return the response with CORS headers
    const headers = new Headers();
    
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // Add Content-Type header if not already present
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    
    console.log("Successfully processed request, returning response");
    return new Response(response.body, {
      status: response.status,
      headers: headers
    });
  } catch (error) {
    console.error("Error in test-workflow-prompt function:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
