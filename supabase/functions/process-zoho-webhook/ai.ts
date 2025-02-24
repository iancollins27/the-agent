
export async function generateSummary(prompt: string, apiKey: string) {
  const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
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
  })

  const openAIData = await openAIResponse.json()
  return openAIData.choices[0].message.content;
}
