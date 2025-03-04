
// Get AI provider and model from the database or use defaults
export async function generateSummary(prompt: string, apiKey: string, aiProvider: string = 'openai', aiModel: string = 'gpt-4o') {
  if (aiProvider === 'openai') {
    return generateWithOpenAI(prompt, apiKey, aiModel);
  } else if (aiProvider === 'claude') {
    return generateWithClaude(prompt, apiKey, aiModel);
  } else if (aiProvider === 'deepseek') {
    return generateWithDeepseek(prompt, apiKey, aiModel);
  } else {
    // Default to OpenAI if provider is not recognized
    return generateWithOpenAI(prompt, apiKey, 'gpt-4o');
  }
}

async function generateWithOpenAI(prompt: string, apiKey: string, model: string = 'gpt-4o') {
  const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant that generates concise project summaries focusing on timeline milestones.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
    }),
  });

  const openAIData = await openAIResponse.json();
  if (openAIData.error) {
    throw new Error(`OpenAI API error: ${openAIData.error.message || JSON.stringify(openAIData.error)}`);
  }
  return openAIData.choices[0].message.content;
}

async function generateWithClaude(prompt: string, apiKey: string, model: string = 'claude-3-haiku-20240307') {
  const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { 
          role: 'user', 
          content: 'You are a helpful assistant that generates concise project summaries focusing on timeline milestones. ' + prompt 
        }
      ],
      max_tokens: 1000,
    }),
  });

  const claudeData = await claudeResponse.json();
  if (claudeData.error) {
    throw new Error(`Claude API error: ${claudeData.error.message || JSON.stringify(claudeData.error)}`);
  }
  return claudeData.content[0].text;
}

async function generateWithDeepseek(prompt: string, apiKey: string, model: string = 'deepseek-chat') {
  const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant that generates concise project summaries focusing on timeline milestones.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  const deepseekData = await deepseekResponse.json();
  if (deepseekData.error) {
    throw new Error(`DeepSeek API error: ${deepseekData.error.message || JSON.stringify(deepseekData.error)}`);
  }
  return deepseekData.choices[0].message.content;
}
