import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

export async function generateSummary(prompt: string, apiKey: string, provider: string = 'openai', model: string = 'gpt-4o') {
  console.log(`Generating summary using ${provider} model: ${model}`);
  let promptRunId: string | null = null;
  
  // Create a Supabase client for this function
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    // Log the prompt run
    const { data: promptRun, error: logError } = await supabase
      .from('prompt_runs')
      .insert({
        prompt_input: prompt,
        status: 'PENDING'
      })
      .select()
      .single();
      
    if (logError) {
      console.error('Error logging prompt run:', logError);
    } else {
      promptRunId = promptRun.id;
    }
    
    let response;
    
    if (provider === 'openai') {
      response = await callOpenAI(prompt, apiKey, model);
    } else if (provider === 'claude') {
      response = await callClaude(prompt, apiKey, model);
    } else if (provider === 'deepseek') {
      response = await callDeepseek(prompt, apiKey, model);
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
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
    
    throw error;
  }
}

async function callOpenAI(prompt: string, apiKey: string, model: string = 'gpt-4o') {
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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callClaude(prompt: string, apiKey: string, model: string = 'claude-3-5-haiku-20241022') {
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
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callDeepseek(prompt: string, apiKey: string, model: string = 'deepseek-chat') {
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
    const error = await response.json();
    throw new Error(error.error?.message || 'DeepSeek API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
