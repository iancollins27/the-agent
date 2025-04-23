
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

    const { record_id, process_all_chunks = false } = await req.json();
    console.log('Processing document with record ID:', record_id, 'process_all_chunks:', process_all_chunks);

    // Get the document record
    const { data: doc, error: docError } = await supabase
      .from('knowledge_base_embeddings')
      .select('*')
      .eq('id', record_id)
      .single();

    if (docError || !doc) {
      throw new Error(`Failed to fetch document: ${docError?.message || 'Document not found'}`);
    }

    // If this is a child chunk and not a direct process request, check if we should process it
    if (doc.metadata?.parent_id && !process_all_chunks) {
      console.log(`This is a child chunk (${doc.metadata.chunk_index}/${doc.metadata.total_chunks}) and process_all_chunks is not enabled. Skipping.`);
      return new Response(JSON.stringify({ 
        success: true,
        message: `Child chunk processing skipped. Set process_all_chunks=true to process this chunk.`,
        status: 'skipped',
        chunk_info: {
          index: doc.metadata.chunk_index,
          total: doc.metadata.total_chunks,
          parent_id: doc.metadata.parent_id
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
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

    // For parent documents, we need to download the file
    let text = '';
    let chunks: string[] = [];

    // Only download and process the file for the parent document or if this is a single standalone document
    if (!doc.metadata?.parent_id) {
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
      chunks = chunk(text, 1000);
      console.log(`Split content into ${chunks.length} chunks`);

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
          const { data: insertedChunks, error: insertError } = await supabase
            .from('knowledge_base_embeddings')
            .insert(additionalChunks)
            .select('id');
            
          if (insertError) {
            console.error('Error creating additional chunk records:', insertError);
          } else {
            console.log(`Successfully created ${insertedChunks.length} additional chunk records`);
            
            // If we want to process all chunks immediately, trigger processing for each chunk
            if (process_all_chunks) {
              console.log('Processing all chunks in parallel');
              const processingPromises = insertedChunks.map(chunk => {
                return supabase.functions.invoke('process-document-embedding', {
                  body: { record_id: chunk.id, process_all_chunks: true }
                });
              });
              
              // Use Promise.allSettled to process all chunks without failing if one fails
              EdgeRuntime.waitUntil(Promise.allSettled(processingPromises).then(results => {
                console.log(`Chunk processing complete. Results: ${results.map(r => r.status).join(', ')}`);
              }));
            }
          }
        }
      }
    } else {
      // This is a child chunk, so we need to get its content from the parent
      console.log(`Processing child chunk ${doc.metadata.chunk_index}/${doc.metadata.total_chunks}`);
      
      // Get the parent document
      const { data: parentDoc, error: parentError } = await supabase
        .from('knowledge_base_embeddings')
        .select('*')
        .eq('id', doc.metadata.parent_id)
        .single();
        
      if (parentError || !parentDoc) {
        await supabase
          .from('knowledge_base_embeddings')
          .update({
            metadata: {
              ...doc.metadata,
              processing_status: 'failed',
              error: `Failed to fetch parent document: ${parentError?.message || 'Parent not found'}`,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', record_id);
          
        throw new Error(`Failed to fetch parent document: ${parentError?.message || 'Parent not found'}`);
      }
      
      // Get the file content
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('knowledge_base_documents')
        .download(parentDoc.source_id);

      if (fileError || !fileData) {
        await supabase
          .from('knowledge_base_embeddings')
          .update({
            metadata: {
              ...doc.metadata,
              processing_status: 'failed',
              error: `Failed to download file from parent: ${fileError?.message || 'Unknown error'}`,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', record_id);
          
        throw new Error(`Failed to download file from parent: ${fileError?.message || 'Unknown error'}`);
      }
      
      // Extract text and get the specific chunk
      try {
        if (parentDoc.file_type === 'application/pdf') {
          text = await extractTextFromPDF(fileData);
        } else if (parentDoc.file_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          text = await fileData.text();
        } else {
          throw new Error(`Unsupported file type: ${parentDoc.file_type}`);
        }
        
        chunks = chunk(text, 1000);
        
        if (doc.metadata.chunk_index >= chunks.length) {
          throw new Error(`Chunk index out of bounds: ${doc.metadata.chunk_index} >= ${chunks.length}`);
        }
        
        // We only need the specific chunk for this record
        chunks = [chunks[doc.metadata.chunk_index]];
        console.log(`Using chunk ${doc.metadata.chunk_index} with ${chunks[0].length} characters`);
      } catch (error) {
        await supabase
          .from('knowledge_base_embeddings')
          .update({
            metadata: {
              ...doc.metadata,
              processing_status: 'failed',
              error: `Chunk extraction failed: ${error.message}`,
              failed_at: new Date().toISOString()
            }
          })
          .eq('id', record_id);
          
        throw error;
      }
    }
    
    // Now process the current chunk
    let success = false;
    
    try {
      const chunkContent = chunks[0];
      
      if (!chunkContent || !chunkContent.trim()) {
        console.log('Chunk is empty, skipping');
        throw new Error('Chunk is empty, nothing to process');
      }
      
      console.log(`Processing chunk with ${chunkContent.length} characters`);
      
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
            chunk_index: doc.metadata?.chunk_index || 0,
            total_chunks: doc.metadata?.total_chunks || chunks.length,
            processed_at: new Date().toISOString(),
            processing_status: 'completed'
          }
        })
        .eq('id', record_id);

      if (updateError) {
        throw updateError;
      }
      
      success = true;
      console.log(`Successfully processed chunk with ${chunkContent.length} characters`);
      
    } catch (error) {
      console.error(`Error processing chunk:`, error);
      
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

    const response = {
      success,
      message: success ? 'Document processing completed successfully' : 'Document processing failed',
      record_id,
      chunk_info: {
        current: doc.metadata?.chunk_index || 0,
        total: doc.metadata?.total_chunks || chunks.length
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: success ? 200 : 500
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
