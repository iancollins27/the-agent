
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { messages, projectId } = await req.json()
    
    // Fetch the latest chatbot configuration
    const { data: configData, error: configError } = await supabase
      .from('chatbot_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (configError && configError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching chatbot config:', configError);
    }
    
    // Default configuration if none found
    const botConfig = configData || {
      system_prompt: `You are an intelligent project assistant that helps manage project workflows.
      Answer questions about projects or workflow processes. If you don't know something, say so clearly.
      When asked about schedules or timelines, check the summary and next_step fields for relevant information.
      If no scheduling information is found, suggest contacting the project manager for more details.`,
      model: 'gpt-4o-mini',
      temperature: 0.7,
      search_project_data: true
    };
    
    console.log('Using bot configuration:', botConfig);

    // Fetch AI provider configuration
    const { data: aiConfig, error: aiConfigError } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const aiProvider = aiConfig?.provider || 'openai';
    const aiModel = botConfig.model || 'gpt-4o-mini'; // Use model from chatbot config as fallback
    
    console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);
    
    // Extract the latest user message to check for CRM ID
    const latestUserMessage = messages.length > 0 && messages[messages.length - 1].role === 'user' 
      ? messages[messages.length - 1].content 
      : '';
    
    // Check if the message mentions a CRM ID
    const crmIdMatch = latestUserMessage.match(/crm\s*id\s*(\d+)/i) || 
                       latestUserMessage.match(/crmid\s*(\d+)/i) || 
                       latestUserMessage.match(/project\s*(\d+)/i);
    
    let projectData = null;
    let searchContext = '';
    
    // Only search for project data if enabled in config
    if (botConfig.search_project_data !== false) {
      // First try to get project by explicit projectId
      if (projectId) {
        console.log('Fetching project data for ID:', projectId);
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select(`
            id, 
            summary, 
            next_step,
            project_track,
            company_id,
            companies(name)
          `)
          .eq('id', projectId)
          .single();

        if (projectError) {
          console.error('Error fetching project by ID:', projectError);
        } else if (project) {
          projectData = project;
          console.log('Found project data by ID:', project);
        }
      } 
      // If no project found by ID or no ID provided, try CRM ID
      else if (crmIdMatch && crmIdMatch[1]) {
        const crmId = crmIdMatch[1];
        console.log('Attempting to fetch project by CRM ID:', crmId);
        
        const { data: projects, error: crmError } = await supabase
          .from('projects')
          .select(`
            id, 
            summary, 
            next_step,
            project_track,
            crm_id,
            company_id,
            companies(name)
          `)
          .eq('crm_id', crmId);
        
        if (crmError) {
          console.error('Error fetching project by CRM ID:', crmError);
        } else if (projects && projects.length > 0) {
          projectData = projects[0];
          console.log('Found project data by CRM ID:', projectData);
          searchContext = `I found information for project with CRM ID ${crmId}.`;
        } else {
          searchContext = `I searched for a project with CRM ID ${crmId} but couldn't find any matching records.`;
        }
      }
    }

    // Fetch related project track information if project has a track
    let trackData = null;
    if (projectData?.project_track) {
      const { data: track, error: trackError } = await supabase
        .from('project_tracks')
        .select('id, name, description')
        .eq('id', projectData.project_track)
        .single();
      
      if (trackError) {
        console.error('Error fetching project track:', trackError);
      } else if (track) {
        trackData = track;
        console.log('Found project track data:', track);
      }
    }

    // Use the custom system prompt from configuration
    const systemMessage = {
      role: 'system',
      content: `${botConfig.system_prompt}
      ${searchContext}
      ${projectData ? `
        Current project information:
        - Project ID: ${projectData.id}
        - Company: ${projectData.companies?.name || 'Unknown'}
        - ${projectData.crm_id ? `CRM ID: ${projectData.crm_id}` : ''}
        - Summary: ${projectData.summary || 'No summary available'}
        - Next Step: ${projectData.next_step || 'No next step defined'}
        ${trackData ? `- Project Track: ${trackData.name}
        - Track Description: ${trackData.description || 'No description available'}` : ''}
      ` : 'No specific project context is loaded.'}`
    }

    // Add system message to the beginning of the messages array
    const fullMessages = [systemMessage, ...messages]

    console.log('Sending messages to AI provider:', aiProvider, 'model:', aiModel);
    console.log('Messages:', fullMessages);
    
    // Log prompt run to database
    const userMessage = messages[messages.length - 1]?.content || '';
    let promptRunId: string | null = null;
    
    // Create a prompt run record
    try {
      const { data: promptRun, error: logError } = await supabase
        .from('prompt_runs')
        .insert({
          project_id: projectData?.id || null,
          prompt_input: JSON.stringify({
            system: systemMessage.content,
            user: userMessage
          }),
          status: 'PENDING'
        })
        .select()
        .single();
        
      if (logError) {
        console.error('Error logging chat prompt run:', logError);
      } else {
        promptRunId = promptRun.id;
        console.log('Created prompt run with ID:', promptRunId);
      }
    } catch (error) {
      console.error('Error creating prompt run:', error);
    }

    // Determine API key based on provider
    let apiKey;
    if (aiProvider === 'openai') {
      apiKey = Deno.env.get('OPENAI_API_KEY');
    } else if (aiProvider === 'claude') {
      apiKey = Deno.env.get('CLAUDE_API_KEY');
    } else if (aiProvider === 'deepseek') {
      apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    } else {
      // Default to OpenAI
      apiKey = Deno.env.get('OPENAI_API_KEY');
    }

    if (!apiKey) {
      throw new Error(`API key for ${aiProvider} is not configured`);
    }

    let aiResponse;
    let error = null;
    
    try {
      // Call appropriate AI provider based on configuration
      if (aiProvider === 'openai') {
        aiResponse = await callOpenAI(fullMessages, apiKey, aiModel, botConfig.temperature || 0.7);
      } else if (aiProvider === 'claude') {
        aiResponse = await callClaude(fullMessages, apiKey, aiModel, botConfig.temperature || 0.7);
      } else if (aiProvider === 'deepseek') {
        aiResponse = await callDeepseek(fullMessages, apiKey, aiModel, botConfig.temperature || 0.7);
      } else {
        // Default to OpenAI if provider is not recognized
        aiResponse = await callOpenAI(fullMessages, apiKey, 'gpt-4o-mini', botConfig.temperature || 0.7);
      }
    } catch (e) {
      error = e;
      console.error('Error calling AI provider:', e);
      aiResponse = "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }
    
    // Update the prompt run with the result
    if (promptRunId) {
      try {
        if (error) {
          await supabase
            .from('prompt_runs')
            .update({
              error_message: error.message || 'Unknown error',
              status: 'ERROR',
              completed_at: new Date().toISOString()
            })
            .eq('id', promptRunId);
        } else {
          await supabase
            .from('prompt_runs')
            .update({
              prompt_output: aiResponse,
              status: 'COMPLETED',
              completed_at: new Date().toISOString()
            })
            .eq('id', promptRunId);
        }
      } catch (updateError) {
        console.error('Error updating prompt run:', updateError);
      }
    }

    console.log('AI response received');
    return new Response(JSON.stringify({ 
      reply: aiResponse,
      projectData: projectData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error in agent-chat function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function callOpenAI(messages, apiKey, model = 'gpt-4o-mini', temperature = 0.7) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('OpenAI API error:', data);
    throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
  }
  
  return data.choices[0].message.content;
}

async function callClaude(messages, apiKey, model = 'claude-3-haiku-20240307', temperature = 0.7) {
  // Convert the messages format to what Claude expects
  const claudeMessages = messages.map(msg => ({
    role: msg.role === 'system' ? 'user' : msg.role,
    content: msg.content
  }));
  
  // If there's a system message, prepend it to the first user message
  const systemMessage = messages.find(msg => msg.role === 'system');
  if (systemMessage && claudeMessages.length > 1) {
    // Find the first non-system message
    const firstUserIndex = claudeMessages.findIndex(msg => msg.role === 'user');
    if (firstUserIndex >= 0) {
      claudeMessages[firstUserIndex].content = 
        `${systemMessage.content}\n\nUser message: ${claudeMessages[firstUserIndex].content}`;
    }
    // Remove the system message
    claudeMessages.shift();
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: claudeMessages,
      max_tokens: 1000,
      temperature: temperature,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Claude API error:', data);
    throw new Error(`Claude API error: ${data.error?.message || 'Unknown error'}`);
  }
  
  return data.content[0].text;
}

async function callDeepseek(messages, apiKey, model = 'deepseek-chat', temperature = 0.7) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: 1000,
    }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('DeepSeek API error:', data);
    throw new Error(`DeepSeek API error: ${data.error?.message || 'Unknown error'}`);
  }
  
  return data.choices[0].message.content;
}
