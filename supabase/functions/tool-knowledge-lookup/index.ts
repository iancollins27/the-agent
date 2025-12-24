/**
 * Tool Edge Function: knowledge-lookup
 * Searches company knowledge base for relevant information
 * 
 * Used by: test-workflow-prompt
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  ToolRequest,
  ToolResponse,
  validateSecurityContext,
  successResponse,
  errorResponse
} from '../_shared/tool-types/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KnowledgeLookupArgs {
  query: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest<KnowledgeLookupArgs> = await req.json();
    
    console.log(`tool-knowledge-lookup called by ${metadata?.orchestrator || 'unknown'}`);
    
    // Validate security context
    const validation = validateSecurityContext(securityContext);
    if (!validation.valid) {
      return new Response(
        JSON.stringify(errorResponse(validation.error!)),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!args.query) {
      return new Response(
        JSON.stringify(errorResponse('query is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const result = await searchKnowledgeBase(
      supabase,
      args.query,
      securityContext.company_id,
      args.limit || 5
    );
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Tool error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function searchKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  query: string,
  companyId: string,
  limit: number
): Promise<ToolResponse> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    if (!embedding) {
      // Fall back to text search if embedding generation fails
      console.log('Embedding generation failed, falling back to text search');
      return await textSearch(supabase, query, companyId, limit);
    }
    
    // Vector search using the match_documents function
    const { data: results, error } = await supabase.rpc('match_documents', {
      embedding: embedding,
      k: limit,
      _company_id: companyId
    });
    
    if (error) {
      console.error('Vector search error:', error);
      return await textSearch(supabase, query, companyId, limit);
    }
    
    if (!results || results.length === 0) {
      return successResponse(
        { results: [] },
        'No relevant knowledge base entries found'
      );
    }
    
    return successResponse(
      { 
        results: results.map((r: any) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          url: r.url,
          similarity: r.similarity
        }))
      },
      `Found ${results.length} relevant knowledge base entries`
    );
    
  } catch (error) {
    console.error('Error in knowledge base search:', error);
    return errorResponse(error.message || 'Knowledge base search failed');
  }
}

async function textSearch(
  supabase: ReturnType<typeof createClient>,
  query: string,
  companyId: string,
  limit: number
): Promise<ToolResponse> {
  const { data, error } = await supabase
    .from('knowledge_base_embeddings')
    .select('id, title, content, url')
    .eq('company_id', companyId)
    .ilike('content', `%${query}%`)
    .limit(limit);
    
  if (error) {
    return errorResponse(`Text search failed: ${error.message}`);
  }
  
  return successResponse(
    { results: data || [] },
    `Found ${data?.length || 0} knowledge base entries via text search`
  );
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      console.error('OPENAI_API_KEY not configured');
      return null;
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });
    
    if (!response.ok) {
      console.error('OpenAI embeddings API error:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}
