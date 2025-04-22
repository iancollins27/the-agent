
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { chunk } from './utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    const requestData = await req.json();
    const { companyId, notionToken, notionDatabaseId, notionPageId } = requestData;

    console.log('Request data:', { companyId, notionDatabaseId, notionPageId });

    if (!companyId) {
      throw new Error('Company ID is required');
    }

    if (!notionToken) {
      throw new Error('Notion token is required');
    }

    // Store Notion credentials in company settings
    const { error: settingsError } = await supabase
      .from('companies')
      .update({
        knowledge_base_settings: {
          notion: {
            token: notionToken,
            database_id: notionDatabaseId || null,
            page_id: notionPageId || null,
            last_sync: new Date().toISOString()
          }
        }
      })
      .eq('id', companyId);

    if (settingsError) {
      console.error('Error updating company settings:', settingsError);
      throw settingsError;
    }

    // Start the background processing of Notion content
    if (notionDatabaseId) {
      // Format the database ID by removing hyphens for Notion API
      const formattedDatabaseId = formatNotionId(notionDatabaseId);
      await processNotionDatabase(supabase, companyId, notionToken, formattedDatabaseId, openaiApiKey);
    } else if (notionPageId) {
      // Format the page ID by removing hyphens for Notion API
      const formattedPageId = formatNotionId(notionPageId);
      await processNotionPage(supabase, companyId, notionToken, formattedPageId, openaiApiKey);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Notion integration started',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Error in process-notion-integration function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Helper function to format Notion IDs correctly
function formatNotionId(id: string): string {
  // If the ID contains hyphens, ensure it's properly formatted
  // Some Notion APIs require IDs without hyphens, others with specific hyphen patterns
  return id.replace(/-/g, '');
}

// Process a Notion database 
async function processNotionDatabase(supabase, companyId, notionToken, databaseId, openaiApiKey) {
  try {
    console.log(`Processing Notion database with ID: ${databaseId}`);
    
    // Fetch database items from Notion API
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 100 // Adjust as needed
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API error:', errorData);
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log(`Processing ${data.results.length} pages from Notion database`);

    // Process each page in the database
    for (const page of data.results) {
      await processNotionPage(supabase, companyId, notionToken, page.id, openaiApiKey);
    }

    return true;
  } catch (error) {
    console.error('Error processing Notion database:', error);
    throw error;
  }
}

// Process a single Notion page
async function processNotionPage(supabase, companyId, notionToken, pageId, openaiApiKey) {
  try {
    console.log(`Processing Notion page with ID: ${pageId}`);
    
    // Fetch page content from Notion API
    const response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API error:', errorData);
      throw new Error(`Notion API error: ${errorData.message || 'Unknown error'}`);
    }

    // Get page info for title
    const pageInfoResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28'
      }
    });

    const pageInfo = await pageInfoResponse.json();
    const pageData = await response.json();
    
    // Extract page title
    let pageTitle = "Untitled";
    if (pageInfo.properties && pageInfo.properties.title) {
      const titleProperty = pageInfo.properties.title;
      if (titleProperty.title && titleProperty.title.length > 0) {
        pageTitle = titleProperty.title.map(t => t.plain_text).join('');
      }
    }

    // Extract and process text content from page blocks
    let fullContent = extractTextFromBlocks(pageData.results);
    console.log(`Extracted ${fullContent.length} characters from page`);

    // Delete any existing embeddings for this page
    const { error: deleteError } = await supabase
      .from('knowledge_base_embeddings')
      .delete()
      .eq('company_id', companyId)
      .eq('source_type', 'notion')
      .eq('source_id', pageId);

    if (deleteError) {
      console.error('Error deleting existing embeddings:', deleteError);
    }

    // Split content into chunks for embedding (to stay within token limits)
    const chunks = chunk(fullContent, 1000); // ~1000 chars per chunk
    console.log(`Split content into ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      
      // Skip empty chunks
      if (!chunkContent.trim()) continue;
      
      // Generate embeddings using OpenAI
      const embedding = await generateEmbedding(chunkContent, openaiApiKey);
      
      // Store the chunk and its embedding
      const { error: insertError } = await supabase
        .from('knowledge_base_embeddings')
        .insert({
          company_id: companyId,
          source_type: 'notion',
          source_id: pageId,
          content: chunkContent,
          embedding: embedding,
          title: pageTitle,
          url: `https://notion.so/${pageId.replace(/-/g, '')}`,
          metadata: {
            chunk_index: i,
            total_chunks: chunks.length
          }
        });

      if (insertError) {
        console.error('Error inserting embedding:', insertError);
        throw insertError;
      }
    }

    return true;
  } catch (error) {
    console.error('Error processing Notion page:', error);
    throw error;
  }
}

// Extract text from Notion blocks
function extractTextFromBlocks(blocks) {
  let text = '';
  
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.paragraph.rich_text) {
      text += block.paragraph.rich_text.map(t => t.plain_text).join('') + '\n\n';
    } 
    else if (block.type === 'heading_1' && block.heading_1.rich_text) {
      text += '# ' + block.heading_1.rich_text.map(t => t.plain_text).join('') + '\n\n';
    }
    else if (block.type === 'heading_2' && block.heading_2.rich_text) {
      text += '## ' + block.heading_2.rich_text.map(t => t.plain_text).join('') + '\n\n';
    }
    else if (block.type === 'heading_3' && block.heading_3.rich_text) {
      text += '### ' + block.heading_3.rich_text.map(t => t.plain_text).join('') + '\n\n';
    }
    else if (block.type === 'bulleted_list_item' && block.bulleted_list_item.rich_text) {
      text += '• ' + block.bulleted_list_item.rich_text.map(t => t.plain_text).join('') + '\n';
    }
    else if (block.type === 'numbered_list_item' && block.numbered_list_item.rich_text) {
      text += '1. ' + block.numbered_list_item.rich_text.map(t => t.plain_text).join('') + '\n';
    }
    else if (block.type === 'to_do' && block.to_do.rich_text) {
      const checked = block.to_do.checked ? '[x]' : '[ ]';
      text += checked + ' ' + block.to_do.rich_text.map(t => t.plain_text).join('') + '\n';
    }
    else if (block.type === 'toggle' && block.toggle.rich_text) {
      text += block.toggle.rich_text.map(t => t.plain_text).join('') + '\n';
    }
    else if (block.type === 'code' && block.code.rich_text) {
      text += '```\n' + block.code.rich_text.map(t => t.plain_text).join('') + '\n```\n';
    }
    else if (block.type === 'quote' && block.quote.rich_text) {
      text += '> ' + block.quote.rich_text.map(t => t.plain_text).join('') + '\n\n';
    }
    else if (block.type === 'callout' && block.callout.rich_text) {
      text += '> ' + block.callout.rich_text.map(t => t.plain_text).join('') + '\n\n';
    }
    else if (block.type === 'table' && block.has_children) {
      // For tables, we'd need to fetch the children separately in a production app
      text += '[Table content - see original in Notion]\n\n';
    }
  }
  
  return text;
}

// Generate embedding using OpenAI
async function generateEmbedding(text, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
