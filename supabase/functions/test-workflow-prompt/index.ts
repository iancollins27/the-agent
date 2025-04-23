
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIProvider, callAIProviderWithMCP } from "./ai-providers.ts";
import { logPromptRun, createActionRecord } from "./database/prompt-runs.ts";
import { getProject } from "./database/projects.ts";
import { searchKnowledgeBase } from "./knowledge-service.ts";
import { sendHumanReviewRequest } from "./human-service.ts";
import { addToolResult, createMCPContext, addAssistantMessage, getDefaultTools } from "./mcp.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { 
      promptText, 
      promptType, 
      projectId, 
      contextData = {},
      aiProvider = 'openai',
      aiModel = 'gpt-4o-mini',
      workflowPromptId,
      initiatedBy = 'manual-test',
      isMultiProjectTest = false,
      useMCP = false,
      humanReviewEmail = null
    } = requestData;

    console.log(`Processing ${promptType} prompt with ${aiProvider} ${aiModel}`);
    console.log(`Using MCP: ${useMCP}`);

    let promptRunId = null;
    try {
      promptRunId = await logPromptRun({
        projectId,
        promptInput: promptText,
        aiProvider,
        aiModel,
        initiatedBy,
        contextData
      });
      console.log(`Created prompt run: ${promptRunId}`);
    } catch (logError) {
      console.error('Failed to log prompt run:', logError);
    }

    let output = '';
    let finalPrompt = promptText;
    let actionRecordId = null;
    let reminderSet = false;
    let nextCheckDateInfo = null;
    let humanReviewRequestId = null;
    let knowledgeResults = 0;

    if (promptType === 'knowledge_query') {
      try {
        console.log("Handling knowledge query...");
        
        if (useMCP) {
          console.log("Using MCP for knowledge query");
          output = await handleKnowledgeQueryWithMCP(promptText, contextData, aiProvider, aiModel);
        } else {
          console.log(`Searching knowledge base for query: "${contextData.query}" in company: ${contextData.company_id}`);
          const searchResults = await searchKnowledgeBase(contextData.query, contextData.company_id);
          knowledgeResults = searchResults?.length || 0;
          console.log(`Found ${knowledgeResults} search results`);
          
          if (searchResults && searchResults.length > 0) {
            const context = searchResults.map(r => 
              `[Source: ${r.title || 'Unknown'}, Similarity: ${r.similarity.toFixed(2)}]
${r.content}`).join('\n\n');
              
            finalPrompt = `Answer the following question using the provided knowledge base context.
            
Context:
${context}

Question: ${contextData.query}`;
            
            console.log("Calling AI provider with knowledge context");
            output = await callAIProvider(aiProvider, aiModel, finalPrompt);
            console.log("Received AI response for knowledge query");
          } else {
            output = "No relevant information found in the knowledge base.";
            console.log("No relevant information found in knowledge base");
          }
        }
      } catch (kbError) {
        console.error('Error in knowledge base query:', kbError);
        output = `Mock result for unknown prompt type\n\nNote: There was an error using the ${aiProvider} API: ${kbError.message || JSON.stringify(kbError)}`;
      }
    } else if (promptType === 'human_review_request' && humanReviewEmail) {
      try {
        humanReviewRequestId = await sendHumanReviewRequest({
          projectId,
          promptRunId,
          reviewerEmail: humanReviewEmail,
          content: contextData.content || promptText,
          reason: contextData.reason || 'Manual review request',
          requestedBy: initiatedBy
        });
        
        output = `Human review request sent to ${humanReviewEmail}`;
      } catch (reviewError) {
        console.error('Error sending human review request:', reviewError);
        output = `Failed to send human review request: ${reviewError.message}`;
      }
    } else {
      try {
        if (useMCP && (aiProvider === 'openai' || aiProvider === 'claude')) {
          const mcpResult = await callAIProviderWithMCP(aiProvider, aiModel, {
            systemPrompt: "You are an AI assistant processing a workflow prompt.",
            userPrompt: promptText,
            tools: []
          });
          
          output = mcpResult?.content || mcpResult?.choices?.[0]?.message?.content || "No output returned";
        } else {
          output = await callAIProvider(aiProvider, aiModel, promptText);
        }
        
      } catch (aiError) {
        console.error('Error calling AI provider:', aiError);
        output = `Error: ${aiError.message || JSON.stringify(aiError)}`;
      }
    }

    if (promptRunId) {
      try {
        // Update the prompt run status directly in the database
        const { data, error } = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/prompt_runs`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
          },
          body: JSON.stringify({
            status: 'COMPLETED',
            prompt_output: output,
            id: promptRunId
          })
        }).then(res => res.json());

        if (error) console.error('Failed to update prompt run:', error);
      } catch (updateError) {
        console.error('Failed to update prompt run:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        output,
        finalPrompt,
        promptType,
        aiProvider,
        aiModel,
        promptRunId,
        actionRecordId,
        reminderSet,
        nextCheckDateInfo,
        usedMCP: useMCP,
        humanReviewRequestId,
        knowledgeResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in test-workflow-prompt function:', error);
    return new Response(
      JSON.stringify({ error: error.message || JSON.stringify(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleKnowledgeQueryWithMCP(promptText: string, contextData: any, aiProvider: string, aiModel: string): Promise<string> {
  try {
    console.log("Starting MCP knowledge query handler");
    
    // First search the knowledge base
    console.log(`Searching knowledge base for query: "${contextData.query}" in company: ${contextData.company_id}`);
    const searchResults = await searchKnowledgeBase(contextData.query, contextData.company_id);
    console.log(`Found ${searchResults?.length || 0} search results`);
    
    if (!searchResults || searchResults.length === 0) {
      return "No relevant information found in the knowledge base.";
    }
    
    // Format the context from search results
    const context = searchResults.map(r => 
      `[Source: ${r.title || 'Unknown'}, Similarity: ${r.similarity.toFixed(2)}]\n${r.content}`
    ).join('\n\n');
    
    // Create MCP context with the knowledge base results already included
    const systemPrompt = "You are an assistant that answers questions based on the provided knowledge base context.";
    const userPrompt = `Answer the following question using ONLY the provided knowledge base context.\n\nContext:\n${context}\n\nQuestion: ${contextData.query}`;
    
    // Call AI provider with the prepared context
    console.log("Calling AI provider with MCP");
    const mcpResult = await callAIProviderWithMCP(aiProvider, aiModel, {
      systemPrompt,
      userPrompt,
      tools: []
    });
    
    console.log("Received MCP response");
    return mcpResult?.content || mcpResult?.choices?.[0]?.message?.content || "No output returned";
  } catch (error) {
    console.error("Error in handleKnowledgeQueryWithMCP:", error);
    throw new Error(`KB search failed: ${error.message || JSON.stringify(error)}`);
  }
}
