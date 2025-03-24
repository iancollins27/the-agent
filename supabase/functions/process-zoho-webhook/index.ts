
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { handleZohoWebhook } from "./handlers/webhookHandler.ts"
import { corsHeaders } from "./utils/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  return handleZohoWebhook(req)
})
