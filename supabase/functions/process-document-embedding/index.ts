
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chunk } from './utils.ts';
import { extractTextFromPDF } from './textExtraction.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key is required');
    }

    const { record_id } = await req.json();
    console.log('Processing document with record ID:', record_id);

    // Get the document record
    const { data: doc, error: docError } = await supabase
      .from('knowledge_base_embeddings')
      .select('*')
      .eq('id', record_id)
      .single();

    if (docError || !doc) {
      throw new Error(`Failed to fetch document: ${docError?.message}`);
    }

    // Get the file content
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('knowledge_base_documents')
      .download(doc.source_id);

    if (fileError || !fileData) {
      throw new Error(`Failed to download file: ${fileError?.message}`);
    }

    // Convert file content to text based on file type
    let text = '';
    if (doc.file_type === 'application/pdf') {
      text = await extractTextFromPDF(fileData);
    } else if (doc.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // For DOCX, we'll use the text content for now
      // TODO: Implement better DOCX parsing if needed
      text = await fileData.text();
    } else {
      throw new Error(`Unsupported file type: ${doc.file_type}`);
    }

    if (!text.trim()) {
      throw new Error('No text content could be extracted from the document');
    }

    // Update the processing status
    await supabase
      .from('knowledge_base_embeddings')
      .update({
        metadata: {
          ...doc.metadata,
          processing_status: 'processing',
          started_at: new Date().toISOString()
        }
      })
      .eq('id', record_id);

    // Split text into chunks
    const chunks = chunk(text, 1000);
    console.log(`Split content into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      
      if (!chunkContent.trim()) continue;
      
      try {
        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunkContent
          })
        });

        if (!embeddingResponse.ok) {
          const error = await embeddingResponse.text();
          throw new Error(`OpenAI API error: ${error}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Update the document with content and embedding
        const { error: updateError } = await supabase
          .from('knowledge_base_embeddings')
          .update({
            content: chunkContent,
            embedding: embedding,
            metadata: {
              ...doc.metadata,
              chunk_index: i,
              total_chunks: chunks.length,
              processed_at: new Date().toISOString(),
              processing_status: 'completed'
            }
          })
          .eq('id', record_id);

        if (updateError) {
          throw updateError;
        }

        console.log(`Processed chunk ${i + 1}/${chunks.length}`);
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        // Update status to failed but continue with other chunks
        await supabase
          .from('knowledge_base_embeddings')
          .update({
            metadata: {
              ...doc.metadata,
              processing_status: 'failed',
              error: error.message,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', record_id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Successfully processed document with ${chunks.length} chunks` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in process-document-embedding:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
