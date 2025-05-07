
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./utils/headers.ts";
import { DataFetchRouter } from "./services/router.ts";
import { validateRequest } from "./middleware/validator.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate request and extract parameters
    const { body, error } = await validateRequest(req);
    if (error) return error;

    const { project_id, include_raw = false } = body;

    console.log(`Processing data.fetch request: project=${project_id}`);

    // Initialize router and fetch data
    const router = new DataFetchRouter(supabase);
    const result = await router.fetchProjectData(project_id, include_raw);

    return new Response(
      JSON.stringify({
        status: "success",
        ...result
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Error in data-fetch function:", error.message);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
