
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || '';

// Create a Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Searches the knowledge base for relevant content based on the provided query
 */
export async function searchKnowledgeBase(query: string, companyId: string, limit: number = 5): Promise<any[]> {
  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    if (!query || !companyId) {
      throw new Error('Missing required parameters: query and company_id');
    }

    console.log(`Searching knowledge base for company ${companyId} with query: ${query}`);

    // First, check if there are any embeddings at all for this company
    const { data: embeddingCheck, error: checkError } = await supabase
      .from('knowledge_base_embeddings')
      .select('id, embedding')
      .eq('company_id', companyId)
      .limit(1);

    if (checkError) {
      throw new Error(`Failed to check embeddings: ${checkError.message}`);
    }

    if (!embeddingCheck || embeddingCheck.length === 0) {
      console.log('No embeddings found for this company');
      return [];
    }

    // Check if the embeddings are actually vectors and not null
    if (!embeddingCheck[0].embedding) {
      console.log('Embeddings exist but are null');
      return [];
    }

    // Generate embedding for the query
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
      throw new Error(`Failed to generate embedding: ${errorText}`);
    }

    const { data: embeddingData } = await embeddingResponse.json();
    
    if (!embeddingData || !embeddingData[0] || !embeddingData[0].embedding) {
      throw new Error('Failed to get valid embedding from OpenAI');
    }
    
    const embedding = embeddingData[0].embedding;

    // Call match_documents RPC
    const { data: results, error } = await supabase.rpc(
      'match_documents',
      { 
        embedding,
        k: limit,
        _company_id: companyId
      }
    );

    if (error) {
      throw error;
    }

    console.log(`Found ${results?.length || 0} matching documents`);
    return results || [];
    
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    throw error;
  }
}
