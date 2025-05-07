
import { corsHeaders } from "../utils/headers.ts";

// Valid resource types
const VALID_RESOURCES = ["project", "task", "note", "email", "sms"];

export async function validateRequest(req: Request): Promise<{ body: any; error: null } | { body: null; error: Response }> {
  try {
    const body = await req.json();

    // Validate company_id
    if (!body.company_id) {
      return {
        body: null,
        error: new Response(
          JSON.stringify({ 
            status: "error",
            error: "Missing required parameter: company_id" 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 400 
          }
        )
      };
    }

    // Validate resource type
    if (!body.resource || !VALID_RESOURCES.includes(body.resource)) {
      return {
        body: null,
        error: new Response(
          JSON.stringify({ 
            status: "error",
            error: `Invalid or missing resource type. Must be one of: ${VALID_RESOURCES.join(", ")}` 
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
