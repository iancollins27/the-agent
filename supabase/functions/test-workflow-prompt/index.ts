import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIProvider, callAIProviderWithMCP } from "./ai-providers.ts";
import { logPromptRun, createActionRecord } from "./database/prompt-runs.ts";
import { getProject } from "./database/projects.ts";
import { searchKnowledgeBase } from "./knowledge-service.ts";
import { sendHumanReviewRequest } from "./human-service.ts";
import { 
  addToolResult, 
  createMCPContext, 
  addAssistantMessage, 
  getDefaultTools 
} from "./mcp.ts";
import { replaceVariables } from "./utils.ts";

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
        contextData  // This will be handled in the function, not directly inserted
      });
      console.log(`Created prompt run: ${promptRunId}`);
    } catch (logError) {
      console.error('Failed to log prompt run:', logError);
    }

    let output = '';
    // Apply variable replacement to the prompt text before processing
    let finalPrompt = replaceVariables(promptText, contextData);
    let actionRecordId = null;
    let reminderSet = false;
    let nextCheckDateInfo = null;
    let humanReviewRequestId = null;
    let knowledgeResults = 0;
    let usedMCP = false;

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
          console.log('Creating MCP context for prompt...');
          
          // Create a system prompt tailored to the type of prompt
          let systemPrompt = "You are an AI assistant processing a workflow prompt.";
          if (promptType === 'action_detection_execution') {
            systemPrompt = "You are an AI assistant responsible for analyzing project details and determining if any automated actions should be taken.";
          } else if (promptType === 'summary_update' || promptType === 'summary_generation') {
            systemPrompt = "You are an AI assistant tasked with summarizing project information and updates.";
          }
          
          // Create the MCP context with proper system and user prompts
          // Use the finalPrompt which has variables replaced instead of the original promptText
          const mcpContext = createMCPContext(systemPrompt, finalPrompt, getDefaultTools());
          
          console.log('MCP Context created with tools. Calling AI with MCP...');
          usedMCP = true;
          
          // Call the AI with MCP formatting
          const mcpResult = await callAIProviderWithMCP(aiProvider, aiModel, mcpContext);
          
          if (mcpResult && (mcpResult.choices?.[0]?.message?.content || mcpResult.content)) {
            output = mcpResult.choices?.[0]?.message?.content || mcpResult.content?.[0]?.text || "No output returned";
            console.log('Received AI response with MCP');
          } else {
            console.error('Invalid MCP result structure:', mcpResult);
            throw new Error('Invalid response from AI provider');
          }
        } else {
          // Use the finalPrompt which has variables replaced instead of the original promptText
          output = await callAIProvider(aiProvider, aiModel, finalPrompt);
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
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            prompt_output: output,
            status: 'COMPLETED',
            completed_at: new Date().toISOString()
          }),
        });
        
        if (error) {
          console.error('Error updating prompt run:', error);
        }
      } catch (updateError) {
        console.error('Error updating prompt run status:', updateError);
      }
    }
    
    // If the prompt type is action_detection_execution, try to create an action record
    if (promptType === 'action_detection_execution' && projectId) {
      try {
        // Detect JSON in the output string
        const jsonOutput = extractJsonFromString(output);
        
        // If valid JSON was detected, check for action decision
        if (jsonOutput && typeof jsonOutput === 'object') {
          const decision = jsonOutput.decision;
          
          // Process the action based on the decision
          if (decision === 'ACTION_NEEDED' || decision === 'SET_FUTURE_REMINDER') {
            const actionResponse = await createActionRecord({
              prompt_run_id: promptRunId,  // Use snake_case for consistency
              project_id: projectId,       // Use snake_case for consistency
              action_type: jsonOutput.action_type || 'NO_ACTION',  // Use snake_case
              action_payload: jsonOutput,  // Use correct column name
              message: jsonOutput.message_text || null,
              status: decision === 'ACTION_NEEDED' ? 'pending' : 'scheduled',
              requires_approval: true
            });
            
            if (actionResponse) {
              actionRecordId = actionResponse;
              console.log(`Created action record: ${actionRecordId}`);
            }
            
            if (decision === 'SET_FUTURE_REMINDER' && jsonOutput.days_until_check) {
              reminderSet = true;
              const nextCheckDate = new Date();
              nextCheckDate.setDate(nextCheckDate.getDate() + jsonOutput.days_until_check);
              nextCheckDateInfo = {
                days: jsonOutput.days_until_check,
                date: nextCheckDate.toISOString()
              };
              
              // Update the project with the next check date
              try {
                if (projectId) {
                  const { error } = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/projects`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                      'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
                      'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                      next_check_date: nextCheckDate.toISOString(),
                      last_action_check: new Date().toISOString()
                    }),
                    
                  });
                  
                  if (error) {
                    console.error('Error updating project next_check_date:', error);
                  }
                }
              } catch (err) {
                console.error('Error updating project with next check date:', err);
              }
            }
          }
        } else {
          console.log('No valid JSON detected in output, skipping action creation');
        }
      } catch (actionError) {
        console.error('Error creating action record:', actionError);
      }
    }

    // If the prompt type is summary_update or summary_generation, update the project summary
    if ((promptType === 'summary_update' || promptType === 'summary_generation') && projectId) {
      try {
        // Update the project with the new summary
        await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/projects`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            id: projectId,
            summary: output
          })
        });
      } catch (summaryUpdateError) {
        console.error('Error updating project summary:', summaryUpdateError);
      }
    }

    return new Response(JSON.stringify({
      output,
      finalPrompt,
      promptRunId,
      actionRecordId,
      reminderSet,
      nextCheckDateInfo,
      usedMCP,
      humanReviewRequestId,
      knowledgeResults
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in test-workflow-prompt function:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      output: `Error occurred: ${error.message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to extract JSON from a string
function extractJsonFromString(inputString) {
  try {
    // First, check if the entire string is valid JSON
    try {
      return JSON.parse(inputString);
    } catch (e) {
      // Not valid JSON, continue with extraction
    }
    
    // Look for JSON objects wrapped in curly braces
    const jsonRegex = /{[\s\S]*?}/gm;
    const matches = inputString.match(jsonRegex);
    
    if (matches && matches.length > 0) {
      // Try each match to find valid JSON
      for (const match of matches) {
        try {
          const parsedJson = JSON.parse(match);
          if (parsedJson && typeof parsedJson === 'object') {
            return parsedJson;
          }
        } catch (e) {
          // Not valid JSON, try the next match
          continue;
        }
      }
    }
    
    // If no valid JSON found, check for JSON delimiters
    const jsonStartIndex = inputString.indexOf('{');
    const jsonEndIndex = inputString.lastIndexOf('}');
    
    if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
      const jsonSubstring = inputString.substring(jsonStartIndex, jsonEndIndex + 1);
      try {
        return JSON.parse(jsonSubstring);
      } catch (e) {
        // Not valid JSON
      }
    }
    
    // No valid JSON found
    return null;
  } catch (error) {
    console.error('Error extracting JSON from string:', error);
    return null;
  }
}

// Helper function to handle knowledge queries with MCP
async function handleKnowledgeQueryWithMCP(promptText, contextData, aiProvider, aiModel) {
  console.log('Setting up MCP for knowledge query');
  
  // Create a system prompt for knowledge querying
  const systemPrompt = "You are a knowledge assistant that helps find and synthesize information from the knowledge base.";
  
  // Create the initial MCP context with the query
  const mcpContext = createMCPContext(
    systemPrompt,
    `Question: ${contextData.query}`,
    getDefaultTools()
  );
  
  try {
    // First, search the knowledge base
    console.log('Searching knowledge base with MCP...');
    const searchResults = await searchKnowledgeBase(contextData.query, contextData.company_id);
    
    if (!searchResults || searchResults.length === 0) {
      console.log('No knowledge base results found');
      return "I couldn't find any relevant information in the knowledge base for your query.";
    }
    
    // Format knowledge results and add them to the context
    const formattedResults = {
      results: searchResults.map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        url: r.url,
        similarity: r.similarity
      }))
    };
    
    // Add the search results to the MCP context
    const contextWithResults = addToolResult(
      mcpContext,
      'knowledge_base_lookup',
      formattedResults
    );
    
    // Add instruction for the AI to process the results
    const finalContext = addAssistantMessage(
      contextWithResults,
      "I've found some potentially relevant information in the knowledge base. Let me use this to answer your question."
    );
    
    // Call the AI provider with the complete context
    console.log('Calling AI provider with knowledge context using MCP');
    const result = await callAIProviderWithMCP(aiProvider, aiModel, finalContext);
    
    if (!result) {
      throw new Error('No response received from AI provider');
    }
    
    // Extract the content from the response
    return result.choices?.[0]?.message?.content || 
           (Array.isArray(result.content) ? result.content[0]?.text : result.content) || 
           "Error: Unable to process knowledge base results";
  } catch (error) {
    console.error('Error in MCP knowledge query:', error);
    return `Error processing knowledge query: ${error.message}`;
  }
}
