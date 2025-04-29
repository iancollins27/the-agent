
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

export async function generateSummary(
  prompt: string, 
  apiKey: string, 
  provider: string = 'openai', 
  model: string = 'gpt-4o', 
  existingPromptRunId: string | null = null
) {
  console.log(`Generating summary using ${provider} model: ${model}`);
  let promptRunId: string | null = existingPromptRunId;
  
  // Create a Supabase client for this function
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    // Validate prompt input
    if (!prompt || prompt.trim() === '') {
      throw new Error('Cannot generate summary with empty prompt');
    }

    // Only log a new prompt run if we don't have an existing one
    if (!promptRunId) {
      console.log("No existing promptRunId provided, creating new prompt run record");
      console.log(`Prompt length: ${prompt.length} characters`);
      console.log(`Prompt snippet: ${prompt.substring(0, 200)}...`);
      
      const { data: promptRun, error: logError } = await supabase
        .from('prompt_runs')
        .insert({
          prompt_input: prompt,
          ai_provider: provider,
          ai_model: model,
          status: 'PENDING'
        })
        .select()
        .single();
        
      if (logError) {
        console.error('Error logging prompt run:', logError);
      } else {
        promptRunId = promptRun.id;
        console.log(`Created new prompt run with ID: ${promptRunId}`);
      }
    } else {
      console.log(`Using existing prompt run ID: ${promptRunId}`);
    }
    
    let response;
    let retries = 0;
    const maxRetries = 3;
    let lastError;
    
    // Retry loop for resilience against transient API errors
    while (retries < maxRetries) {
      try {
        if (provider === 'openai') {
          console.log(`Attempt ${retries + 1} to call OpenAI API with model ${model}`);
          response = await callOpenAI(prompt, apiKey, model);
          break; // Success, exit the retry loop
        } else if (provider === 'claude') {
          response = await callClaude(prompt, apiKey, model);
          break;
        } else if (provider === 'deepseek') {
          response = await callDeepseek(prompt, apiKey, model);
          break;
        } else {
          throw new Error(`Unsupported AI provider: ${provider}`);
        }
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${retries + 1} failed with error:`, error.message || error);
        
        // Check if this is a rate limit error or server error (which may benefit from a retry)
        const shouldRetry = error.message?.includes('rate limit') || 
                           error.message?.includes('server had an error') ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('500') ||
                           error.message?.includes('503');
                           
        if (!shouldRetry) {
          console.log('Error does not appear to be retryable, breaking retry loop');
          break;
        }
        
        retries++;
        if (retries < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const backoffTime = Math.pow(2, retries) * 1000;
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we've exhausted retries and still have an error, throw it
    if (retries === maxRetries && lastError) {
      throw lastError;
    }
    
    // If we have a response, attempt a fallback provider if enabled
    if (!response && provider === 'openai') {
      console.log('OpenAI failed after retries, attempting to use Claude as fallback...');
      try {
        const claudeApiKey = Deno.env.get('CLAUDE_API_KEY');
        if (claudeApiKey) {
          response = await callClaude(prompt, claudeApiKey, 'claude-3-5-haiku-20241022');
          console.log('Successfully used Claude as fallback');
        } else {
          console.log('No Claude API key configured for fallback');
        }
      } catch (fallbackError) {
        console.error('Error using Claude as fallback:', fallbackError);
        // Continue with the original error if fallback fails
      }
    }
    
    if (!response) {
      throw new Error('Failed to generate response from any AI provider');
    }
    
    // Update the prompt run with the result
    if (promptRunId) {
      await supabase
        .from('prompt_runs')
        .update({
          prompt_output: response,
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .eq('id', promptRunId);
      
      console.log(`Updated prompt run ${promptRunId} with result`);
    }
    
    return response;
  } catch (error) {
    console.error(`Error generating summary with ${provider}:`, error);
    
    // Update the prompt run with the error
    if (promptRunId) {
      await supabase
        .from('prompt_runs')
        .update({
          error_message: error.message || 'Unknown error',
          status: 'ERROR',
          completed_at: new Date().toISOString()
        })
        .eq('id', promptRunId);
    }
    
    // Generate a fallback simple summary if the AI service fails
    try {
      const fallbackSummary = `Unable to generate AI summary due to service error: ${error.message}. This is a basic fallback summary based on the raw data provided.`;
      
      if (promptRunId) {
        await supabase
          .from('prompt_runs')
          .update({
            prompt_output: fallbackSummary,
            status: 'COMPLETED_FALLBACK',
            completed_at: new Date().toISOString()
          })
          .eq('id', promptRunId);
      }
      
      return fallbackSummary;
    } catch (fallbackError) {
      console.error('Error generating fallback summary:', fallbackError);
      throw error; // Throw the original error
    }
  }
}

async function callOpenAI(prompt: string, apiKey: string, model: string = 'gpt-4o') {
  console.log(`Making OpenAI API request with model: ${model}`);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    // Enhanced error handling with status code and response body
    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage;
      
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || `OpenAI API error: ${response.status}`;
      } catch {
        errorMessage = `OpenAI API error: ${response.status} - ${errorBody.substring(0, 200)}`;
      }
      
      console.error(`OpenAI API error details: Status ${response.status}, Body:`, errorBody);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`Error in callOpenAI: ${error.message}`);
    throw error;
  }
}

async function callClaude(prompt: string, apiKey: string, model: string = 'claude-3-5-haiku-20241022') {
  console.log(`Making Anthropic Claude API request with model: ${model}`);
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage;
      
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || `Claude API error: ${response.status}`;
      } catch {
        errorMessage = `Claude API error: ${response.status} - ${errorBody.substring(0, 200)}`;
      }
      
      console.error(`Claude API error details: Status ${response.status}, Body:`, errorBody);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.content[0].text;
  } catch (error) {
    console.error(`Error in callClaude: ${error.message}`);
    throw error;
  }
}

async function callDeepseek(prompt: string, apiKey: string, model: string = 'deepseek-chat') {
  console.log(`Making DeepSeek API request with model: ${model}`);
  
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage;
      
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error?.message || `DeepSeek API error: ${response.status}`;
      } catch {
        errorMessage = `DeepSeek API error: ${response.status} - ${errorBody.substring(0, 200)}`;
      }
      
      console.error(`DeepSeek API error details: Status ${response.status}, Body:`, errorBody);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`Error in callDeepseek: ${error.message}`);
    throw error;
  }
}
