
import { corsHeaders } from "../utils/headers.ts";

export async function validateRequest(req: Request): Promise<{ body: any; error: null } | { body: null; error: Response }> {
  try {
    const body = await req.json();

    // Validate project_id
    if (!body.project_id) {
      return {
        body: null,
        error: new Response(
          JSON.stringify({ 
            status: "error",
            error: "Missing required parameter: project_id" 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 400 
          }
        )
      };
    }

    return { body, error: null };
  } catch (error) {
    return {
      body: null,
      error: new Response(
        JSON.stringify({
          status: "error",
          error: "Invalid request body"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      )
    };
  }
}
