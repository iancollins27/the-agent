
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received request to tool-kb-search');
    
    if (!openAIApiKey) {
      console.error("OpenAI API key is not configured");
      return new Response(
        JSON.stringify({ error: "OpenAI API key is not configured", diagnostic: "OpenAI API key is not configured" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }

    const requestData = await req.json();
    const { query, company_id, top_k = 5 } = requestData;

    console.log(`Received request with query: "${query}" for company: ${company_id}`);

    if (!query || !company_id) {
      console.error("Missing required parameters");
      throw new Error("Missing required parameters: query and company_id");
    }

    // First, check if there are any embeddings at all for this company
    console.log('Checking if embeddings exist');
    const { data: embeddingCheck, error: checkError } = await supabase
      .from('knowledge_base_embeddings')
      .select('id, embedding')
      .eq('company_id', company_id)
      .limit(1);

    if (checkError) {
      console.error("Error checking embeddings:", checkError);
      throw new Error(`Failed to check embeddings: ${checkError.message}`);
    }

    if (!embeddingCheck || embeddingCheck.length === 0) {
      console.log("No embeddings found for this company");
      return new Response(
        JSON.stringify({ 
          results: [],
          diagnostic: "No embeddings found for this company. Please make sure documents have been uploaded and properly processed." 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Check if the embeddings are actually vectors and not null
    if (!embeddingCheck[0].embedding) {
      console.log("Embeddings exist but are null");
      
      // Count documents with null embeddings
      const { data: nullEmbeddingsCount, error: nullCountError } = await supabase
        .from('knowledge_base_embeddings')
        .select('id', { count: 'exact' })
        .eq('company_id', company_id)
        .is('embedding', null);
      
      if (nullCountError) {
        console.error("Error counting null embeddings:", nullCountError);
      } else {
        console.log(`Found ${nullEmbeddingsCount?.length || 0} documents with null embeddings`);
      }
      
      // Count total documents
      const { data: totalCount, error: totalCountError } = await supabase
        .from('knowledge_base_embeddings')
        .select('id', { count: 'exact' })
        .eq('company_id', company_id);
      
      if (totalCountError) {
        console.error("Error counting total documents:", totalCountError);
      } else {
        console.log(`Total documents: ${totalCount?.length || 0}`);
      }
      
      return new Response(
        JSON.stringify({ 
          results: [],
          diagnostic: "Documents exist but embeddings are null. They need to be processed with the OpenAI embedding API." 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200
        }
      );
    }

    // Generate embedding for the query
    console.log('Generating embedding for query');
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

      const embeddingData = await embeddingResponse.json();
      
      if (!embeddingData || !embeddingData.data || !embeddingData.data[0] || !embeddingData.data[0].embedding) {
        console.error("Invalid embedding response:", embeddingData);
        throw new Error("Failed to get valid embedding from OpenAI");
      }
      
      const embedding = embeddingData.data[0].embedding;
      console.log('Successfully generated embedding vector');

      // Call match_documents RPC
      console.log('Calling match_documents RPC');
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
        JSON.stringify({ 
          error: `KB search failed: ${error.message}`, 
          diagnostic: `Error generating or using embedding: ${error.message}`
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      );
    }
  } catch (error) {
    console.error("Error in tool-kb-search:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        diagnostic: `General error in knowledge base search: ${error.message}` 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
