
import { ToolContext } from '../types.ts';

export async function knowledgeBaseLookup(args: any, context: ToolContext) {
  const { supabase, companyId } = context;
  const { query, limit = 5 } = args;
  
  // Security check: Verify company context is available
  if (!companyId) {
    console.error("Security error: Missing company context in knowledge-base-lookup tool");
    return {
      status: "error",
      error: "Authentication required to access knowledge base"
    };
  }
  
  if (!query || query.trim().length === 0) {
    return { 
      status: "error", 
      error: "Query parameter is required for knowledge base lookup" 
    };
  }

  try {
    console.log(`Looking up knowledge base for query: "${query}" with company_id: ${companyId}`);
    
    // Get an embedding for the query
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`
      },
      body: JSON.stringify({
        input: query,
        model: "text-embedding-3-small"
      })
    });
    
    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
    }
    
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
    // Search for similar content in the knowledge base, filtered by company
    const { data: documents, error } = await supabase.rpc(
      'match_documents',
      { 
        embedding: embedding,
        k: limit || 5,
        _company_id: companyId  // Important: Filter by company ID
      }
    );
    
    if (error) {
      console.error("Knowledge base lookup error:", error);
      throw error;
    }
    
    if (!documents || documents.length === 0) {
      return {
        status: "success",
        results: [],
        message: "No relevant documents found in the knowledge base."
      };
    }
    
    // Return the results
    return {
      status: "success",
      results: documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        url: doc.url,
        similarity: doc.similarity
      }))
    };
  } catch (error) {
    console.error("Error in knowledgeBaseLookup:", error);
    return {
      status: "error",
      error: error.message
    };
  }
}
