
/**
 * Service for querying the knowledge base
 */

/**
 * Queries the knowledge base for relevant information
 * @param supabase Supabase client
 * @param query The query string to search for
 * @param projectId The project ID to scope the search
 * @returns An array of knowledge base results
 */
export async function queryKnowledgeBase(
  supabase: any,
  query: string,
  projectId: string
): Promise<any[]> {
  try {
    console.log(`Querying knowledge base for project ${projectId} with query: ${query}`);
    
    // First, get the company ID for the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', projectId)
      .single();
      
    if (projectError) {
      console.error('Error fetching project for knowledge base query:', projectError);
      return [];
    }
    
    const companyId = project.company_id;
    if (!companyId) {
      console.error('Project has no company ID, cannot query knowledge base');
      return [];
    }
    
    // Generate embedding for the query
    // In a real implementation, we would call an embedding API
    // For now, we'll use a placeholder function
    const embedding = await generateQueryEmbedding(supabase, query);
    if (!embedding) {
      console.error('Failed to generate embedding for query');
      return [];
    }
    
    // Query the knowledge base using the embedding
    const { data: results, error: searchError } = await supabase.rpc(
      'match_knowledge_embeddings',
      {
        query_embedding: embedding,
        match_threshold: 0.5, // Adjust threshold as needed
        match_count: 5, // Number of results to return
        company_id: companyId
      }
    );
    
    if (searchError) {
      console.error('Error searching knowledge base:', searchError);
      return [];
    }
    
    console.log(`Found ${results?.length || 0} knowledge base results`);
    return results || [];
  } catch (error) {
    console.error('Error in queryKnowledgeBase:', error);
    return [];
  }
}

/**
 * Generates an embedding for a query using OpenAI's embeddings API
 * @param supabase Supabase client (for making HTTP requests)
 * @param text The text to generate an embedding for
 * @returns The embedding array or null if generation failed
 */
async function generateQueryEmbedding(supabase: any, text: string): Promise<number[] | null> {
  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error('OpenAI API key not available for embedding generation');
      return null;
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI embeddings API error:', error);
      return null;
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Formats knowledge base results into a string for inclusion in prompts
 * @param results Knowledge base results from the query
 * @returns A formatted string with knowledge base information
 */
export function formatKnowledgeResults(results: any[]): string {
  if (!results || results.length === 0) {
    return "No relevant knowledge base entries found.";
  }
  
  let formattedResults = "Relevant knowledge base information:\n\n";
  
  results.forEach((result, index) => {
    formattedResults += `[${index + 1}] ${result.title || 'Untitled'}\n`;
    formattedResults += `${result.content}\n`;
    formattedResults += `Relevance: ${result.similarity.toFixed(2)}\n\n`;
  });
  
  return formattedResults;
}
