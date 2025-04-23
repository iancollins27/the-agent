
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      console.error("OpenAI API key is not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key is not configured" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    const { query, company_id, top_k = 5 } = await req.json();

    if (!query || !company_id) {
      throw new Error("Missing required parameters: query and company_id");
    }

    console.log(`Searching KB for company ${company_id} with query: ${query}`);

    // Generate embedding for the query
    try {
      const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openAIApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: query
        })
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        console.error("OpenAI API error:", errorText);
        throw new Error("Failed to generate embedding: " + errorText);
      }

      const { data: embeddingData } = await embeddingResponse.json();
      
      if (!embeddingData || !embeddingData[0] || !embeddingData[0].embedding) {
        console.error("Invalid embedding response:", embeddingData);
        throw new Error("Failed to get valid embedding from OpenAI");
      }
      
      const embedding = embeddingData[0].embedding;

      // Call match_documents RPC
      const { data: results, error } = await supabase.rpc(
        'match_documents',
        { 
          embedding,
          k: top_k,
          _company_id: company_id
        }
      );

      if (error) {
        console.error("Error calling match_documents:", error);
        throw error;
      }

      console.log(`Found ${results?.length || 0} matching documents`);

      return new Response(
        JSON.stringify({ results }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    } catch (error) {
      console.error("Error in OpenAI embedding request:", error);
      return new Response(
        JSON.stringify({ error: `KB search failed: ${JSON.stringify(error)}` }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }
  } catch (error) {
    console.error("Error in tool-kb-search:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
