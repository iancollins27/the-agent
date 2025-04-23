
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
      throw new Error(`Failed to fetch document: ${docError?.message || 'Document not found'}`);
    }

    // Update status to processing
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

    // Get the file content
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('knowledge_base_documents')
      .download(doc.source_id);

    if (fileError || !fileData) {
      // Update status to failed
      await supabase
        .from('knowledge_base_embeddings')
        .update({
          metadata: {
            ...doc.metadata,
            processing_status: 'failed',
            error: `Failed to download file: ${fileError?.message || 'Unknown error'}`,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', record_id);
        
      throw new Error(`Failed to download file: ${fileError?.message || 'Unknown error'}`);
    }

    // Convert file content to text based on file type
    let text = '';
    try {
      console.log(`Processing file of type: ${doc.file_type}`);
      if (doc.file_type === 'application/pdf') {
        console.log('Extracting text from PDF');
        text = await extractTextFromPDF(fileData);
      } else if (doc.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // For DOCX, we'll use the text content for now
        console.log('Extracting text from DOCX');
        text = await fileData.text();
      } else {
        throw new Error(`Unsupported file type: ${doc.file_type}`);
      }
      
      console.log(`Extracted ${text.length} characters of text`);
    } catch (error) {
      // Update status to failed
      await supabase
        .from('knowledge_base_embeddings')
        .update({
          metadata: {
            ...doc.metadata,
            processing_status: 'failed',
            error: `Text extraction failed: ${error.message}`,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', record_id);
        
      throw error;
    }

    if (!text.trim()) {
      // Update status to failed
      await supabase
        .from('knowledge_base_embeddings')
        .update({
          metadata: {
            ...doc.metadata,
            processing_status: 'failed',
            error: 'No text content could be extracted from the document',
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', record_id);
        
      throw new Error('No text content could be extracted from the document');
    }

    // Split text into chunks
    const chunks = chunk(text, 1000);
    console.log(`Split content into ${chunks.length} chunks`);

    let success = false;
    let processedChunks = 0;
    
    // First, create additional records for chunks if needed
    if (chunks.length > 1) {
      console.log(`Creating ${chunks.length - 1} additional records for chunks`);
      
      // For chunks beyond the first one, create new records
      const additionalChunks = [];
      
      for (let i = 1; i < chunks.length; i++) {
        additionalChunks.push({
          company_id: doc.company_id,
          source_id: doc.source_id,
          source_type: doc.source_type,
          content: '',
          title: `${doc.title} (chunk ${i+1}/${chunks.length})`,
          file_name: doc.file_name,
          file_type: doc.file_type,
          metadata: {
            ...doc.metadata,
            parent_id: doc.id,
            chunk_index: i,
            total_chunks: chunks.length,
            processing_status: 'pending'
          }
        });
      }
      
      if (additionalChunks.length > 0) {
        const { error: insertError } = await supabase
          .from('knowledge_base_embeddings')
          .insert(additionalChunks);
          
        if (insertError) {
          console.error('Error creating additional chunk records:', insertError);
        } else {
          console.log(`Successfully created ${additionalChunks.length} additional chunk records`);
        }
      }
    }
    
    // Process the first chunk for this record
    try {
      const chunkContent = chunks[0];
      
      if (!chunkContent.trim()) {
        console.log('First chunk is empty, skipping');
        continue;
      }
      
      console.log(`Processing chunk 1/${chunks.length} with ${chunkContent.length} characters`);
      
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
        const errorText = await embeddingResponse.text();
        throw new Error(`OpenAI API error: ${errorText}`);
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
            chunk_index: 0,
            total_chunks: chunks.length,
            processed_at: new Date().toISOString(),
            processing_status: 'completed'
          }
        })
        .eq('id', record_id);

      if (updateError) {
        throw updateError;
      }
      
      processedChunks++;
      success = true;
      console.log(`Successfully processed chunk 1/${chunks.length}`);
      
    } catch (error) {
      console.error(`Error processing first chunk:`, error);
      
      // Update status to failed
      await supabase
        .from('knowledge_base_embeddings')
        .update({
          metadata: {
            ...doc.metadata,
            processing_status: 'failed',
            error: `Error processing chunk: ${error.message}`,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', record_id);
    }

    // Final status update
    if (success) {
      await supabase
        .from('knowledge_base_embeddings')
        .update({
          metadata: {
            ...doc.metadata,
            processing_status: chunks.length === 1 ? 'completed' : 'partial',
            chunks_processed: processedChunks,
            total_chunks: chunks.length,
            processed_at: new Date().toISOString()
          }
        })
        .eq('id', record_id);
        
      console.log(`Document processing completed with status: ${chunks.length === 1 ? 'completed' : 'partial'}`);
      console.log(`Processed ${processedChunks}/${chunks.length} chunks`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Successfully processed document with ${chunks.length} chunks`,
      chunks_processed: processedChunks,
      total_chunks: chunks.length
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
