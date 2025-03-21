import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import "https://deno.land/x/xhr@0.1.0/mod.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { messages, projectId } = await req.json()
    
    const { data: configData, error: configError } = await supabase
      .from('chatbot_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (configError && configError.code !== 'PGRST116') {
      console.error('Error fetching chatbot config:', configError);
    }
    
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

    const { data: aiConfig, error: aiConfigError } = await supabase
      .from('ai_config')
      .select('provider, model')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    const aiProvider = aiConfig?.provider || 'openai';
    const aiModel = botConfig.model || 'gpt-4o-mini';

    const latestUserMessage = messages.length > 0 && messages[messages.length - 1].role === 'user' 
      ? messages[messages.length - 1].content 
      : '';
    
    const crmIdMatch = latestUserMessage.match(/crm\s*id\s*(\d+)/i) || 
                       latestUserMessage.match(/crmid\s*(\d+)/i) || 
                       latestUserMessage.match(/project\s*(\d+)/i);
    
    let projectData = null;
    let searchContext = '';
    let companyId = null;
    
    if (botConfig.search_project_data !== false) {
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
          companyId = project.company_id;
          console.log('Found project data by ID:', project);
        }
      } else if (crmIdMatch && crmIdMatch[1]) {
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
          companyId = projects[0].company_id;
          console.log('Found project data by CRM ID:', projectData);
          searchContext = `I found information for project with CRM ID ${crmId}.`;
        } else {
          searchContext = `I searched for a project with CRM ID ${crmId} but couldn't find any matching records.`;
        }
      }
    }

    let trackData = null;
    if (projectData?.project_track) {
      const { data: track, error: trackError } = await supabase
        .from('project_tracks')
        .select('id, name, description, Roles')
        .eq('id', projectData.project_track)
        .single();
      
      if (trackError) {
        console.error('Error fetching project track:', trackError);
      } else if (track) {
        trackData = track;
        console.log('Found project track data:', track);
      }
    }

    const isKnowledgeQuery = 
      latestUserMessage.toLowerCase().includes('knowledge base') ||
      latestUserMessage.toLowerCase().includes('find information') ||
      latestUserMessage.toLowerCase().includes('search for') ||
      latestUserMessage.toLowerCase().includes('do you know') ||
      latestUserMessage.toLowerCase().includes('tell me about');
    
    let knowledgeResults = [];
    if (isKnowledgeQuery && companyId) {
      knowledgeResults = await searchKnowledgeBase(supabase, companyId, latestUserMessage);
      
      if (knowledgeResults.length > 0) {
        searchContext += `\nI found some relevant information in the knowledge base that might help answer your question:\n\n`;
        
        knowledgeResults.forEach((result, index) => {
          searchContext += `Source ${index + 1}: ${result.title}\n`;
          searchContext += `Content: ${result.content}\n\n`;
        });
        
        searchContext += `I'll use this information to help answer your question.\n`;
      }
    }

    const notionIntegrationRequest = 
      latestUserMessage.toLowerCase().includes('connect notion') ||
      latestUserMessage.toLowerCase().includes('integrate notion') ||
      latestUserMessage.toLowerCase().includes('notion integration') ||
      latestUserMessage.toLowerCase().includes('add notion') ||
      (latestUserMessage.toLowerCase().includes('notion') && 
       latestUserMessage.toLowerCase().includes('token'));
    
    const actionRequestPatterns = [
      { pattern: /update\s+(the\s+)?(.+?)\s+to\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      { pattern: /change\s+(the\s+)?(.+?)\s+to\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      { pattern: /set\s+(the\s+)?(.+?)\s+to\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      { pattern: /schedule\s+(the\s+)?(.+?)\s+for\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      { pattern: /mark\s+(the\s+)?(.+?)\s+for\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      { pattern: /can you update\s+(the\s+)?(.+?)\s+to\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      { pattern: /please update\s+(the\s+)?(.+?)\s+to\s+(.+?)(?:\?|$|\.|;)/i, type: 'data_update' },
      
      { pattern: /send\s+(a\s+)?message\s+to\s+(.+?)(?:\?|$|\.|;)/i, type: 'message' },
      { pattern: /send\s+(.+?)\s+a\s+message(?:\?|$|\.|;)/i, type: 'message' },
      { pattern: /notify\s+(.+?)(?:\?|$|\.|;)/i, type: 'message' },
      { pattern: /let\s+(.+?)\s+know(?:\?|$|\.|;)/i, type: 'message' },
      { pattern: /inform\s+(.+?)(?:\?|$|\.|;)/i, type: 'message' },
      { pattern: /contact\s+(.+?)(?:\?|$|\.|;)/i, type: 'message' },
      { pattern: /message\s+(.+?)(?:\?|$|\.|;)/i, type: 'message' }
    ];

    let actionRequest = null;
    for (const { pattern, type } of actionRequestPatterns) {
      const match = latestUserMessage.match(pattern);
      if (match) {
        console.log('Detected potential action request:', match);
        actionRequest = { 
          type, 
          match: match.slice(1).filter(Boolean),
          originalMatch: match[0]
        };
        break;
      }
    }

    let systemPromptWithActions = botConfig.system_prompt;
    
    systemPromptWithActions += `\n\nIMPORTANT: You MUST help users update project data when they ask. If users ask you to update fields like installation dates, 
schedules, or other project details, you SHOULD create an update action for them to approve.
When a user asks something like "update the install date to March 16, 2025", you MUST respond with your willingness to help with the update
and provide a JSON block that will be processed automatically.`;

    systemPromptWithActions += `\n\nYou can search the company's knowledge base for information. If a user asks for information that might be in the knowledge base, 
respond with what you know based on the search results I provide to you. If no knowledge base results are provided, tell the user that you don't have that information 
in your knowledge base.`;

    systemPromptWithActions += `\n\nYou can set reminders to check on projects at a future date. If a user asks to "remind me in 2 weeks about this project" or 
"check this project again in 30 days", offer to set a reminder and respond with a JSON block in the format shown below.`;

    if (notionIntegrationRequest) {
      systemPromptWithActions += `\n\nIMPORTANT: The user is asking about integrating with Notion. Inform them that they can connect their Notion workspace by going to the Company Settings page and selecting the Knowledge Base tab.
Let them know that they don't need to provide their credentials through the chat - they can do it securely through the dedicated settings page.`;
    }

    systemPromptWithActions += `\n\nFor data update requests, reply with:
1. A normal conversational response confirming what will be updated
2. A JSON block in this format:

\`\`\`json
{
  "action_type": "data_update",
  "field_to_update": "the field name to update (e.g. 'next_step', 'summary', etc.)",
  "new_value": "the new value for the field",
  "description": "A human-readable description of what's being updated"
}
\`\`\`

For message sending requests (like "send a message to the customer"), reply with:
1. A normal conversational response explaining that you can prepare a message request for approval
2. A JSON block in this format:

\`\`\`json
{
  "action_type": "message",
  "recipient": "the intended recipient (e.g. 'customer', 'team', etc.)",
  "message_content": "the suggested content of the message",
  "description": "A brief description of what the message is about"
}
\`\`\`

For setting reminders to check a project at a future date, reply with:
1. A normal conversational response confirming the reminder will be set
2. A JSON block in this format:

\`\`\`json
{
  "action_type": "set_future_reminder",
  "days_until_check": 14, // number of days until the check should happen
  "check_reason": "Follow up on project progress",
  "description": "A brief description of why we're setting a reminder"
}
\`\`\`

The JSON block MUST be properly formatted as it will be automatically processed.`;

    const systemMessage = {
      role: 'system',
      content: `${systemPromptWithActions}
      ${searchContext}
      ${projectData ? `
        Current project information:
        - Project ID: ${projectData.id}
        - Company: ${projectData.companies?.name || 'Unknown'}
        - ${projectData.crm_id ? `CRM ID: ${projectData.crm_id}` : ''}
        - Summary: ${projectData.summary || 'No summary available'}
        - Next Step: ${projectData.next_step || 'No next step defined'}
        ${trackData ? `- Project Track: ${trackData.name}
        - Track Description: ${trackData.description || 'No description available'}
        - Track Roles: ${trackData.Roles || 'No roles defined'}` : ''}
      ` : 'No specific project context is loaded.'}`
    }

    const fullMessages = [systemMessage, ...messages]

    console.log('Sending messages to AI provider:', aiProvider, 'model:', aiModel);
    console.log('Messages:', fullMessages);
    
    let promptRunId: string | null = null;
    
    try {
      const { data: promptRun, error: logError } = await supabase
        .from('prompt_runs')
        .insert({
          project_id: projectData?.id || null,
          prompt_input: JSON.stringify({
            system: systemMessage.content,
            user: latestUserMessage
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

    let apiKey;
    if (aiProvider === 'openai') {
      apiKey = Deno.env.get('OPENAI_API_KEY');
    } else if (aiProvider === 'claude') {
      apiKey = Deno.env.get('CLAUDE_API_KEY');
    } else if (aiProvider === 'deepseek') {
      apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    } else {
      apiKey = Deno.env.get('OPENAI_API_KEY');
    }

    if (!apiKey) {
      throw new Error(`API key for ${aiProvider} is not configured`);
    }

    let aiResponse;
    let error = null;
    
    try {
      if (aiProvider === 'openai') {
        aiResponse = await callOpenAI(fullMessages, apiKey, aiModel, botConfig.temperature || 0.7);
      } else if (aiProvider === 'claude') {
        aiResponse = await callClaude(fullMessages, apiKey, aiModel, botConfig.temperature || 0.7);
      } else if (aiProvider === 'deepseek') {
        aiResponse = await callDeepseek(fullMessages, apiKey, aiModel, botConfig.temperature || 0.7);
      } else {
        aiResponse = await callOpenAI(fullMessages, apiKey, 'gpt-4o-mini', botConfig.temperature || 0.7);
      }
    } catch (e) {
      error = e;
      console.error('Error calling AI provider:', e);
      aiResponse = "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }
    
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

    console.log('AI response received:', aiResponse);
    
    let actionRecordId = null;
    if (projectData && aiResponse) {
      try {
        const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          const actionData = JSON.parse(jsonMatch[1].trim());
          console.log('Extracted action data:', actionData);
          
          if (actionData.action_type === "data_update" && actionData.field_to_update && actionData.new_value) {
            const { data: actionRecord, error: actionError } = await supabase
              .from('action_records')
              .insert({
                prompt_run_id: promptRunId,
                project_id: projectData.id,
                action_type: 'data_update',
                action_payload: {
                  field: actionData.field_to_update,
                  value: actionData.new_value,
                  description: actionData.description || `Update ${actionData.field_to_update} to ${actionData.new_value}`
                },
                requires_approval: true,
                status: 'pending'
              })
              .select()
              .single();
            
            if (actionError) {
              console.error('Error creating action record:', actionError);
            } else {
              actionRecordId = actionRecord.id;
              console.log('Created data update action record:', actionRecord);
              
              aiResponse = aiResponse.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
            }
          } else if (actionData.action_type === "message" && actionData.recipient && actionData.message_content) {
            let recipientId = null;
            const recipientName = actionData.recipient.trim();
            
            if (recipientName.length > 3 && !["team", "customer", "client", "user"].includes(recipientName.toLowerCase())) {
              const { data: contacts } = await supabase
                .from('contacts')
                .select('id, full_name')
                .ilike('full_name', `%${recipientName}%`);
                
              if (contacts && contacts.length > 0) {
                recipientId = contacts[0].id;
                console.log(`Found contact match for "${recipientName}": ${contacts[0].full_name} (${recipientId})`);
              }
            }
            
            const { data: actionRecord, error: actionError } = await supabase
              .from('action_records')
              .insert({
                prompt_run_id: promptRunId,
                project_id: projectData.id,
                action_type: 'message',
                action_payload: {
                  recipient: actionData.recipient,
                  message_content: actionData.message_content,
                  description: actionData.description || `Send message to ${actionData.recipient}`
                },
                message: actionData.message_content,
                recipient_id: recipientId,
                requires_approval: true,
                status: 'pending'
              })
              .select()
              .single();
            
            if (actionError) {
              console.error('Error creating message action record:', actionError);
            } else {
              actionRecordId = actionRecord.id;
              console.log('Created message action record:', actionRecord);
              
              aiResponse = aiResponse.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
            }
          } else if (actionData.action_type === "set_future_reminder" && actionData.days_until_check) {
            const { data: actionRecord, error: actionError } = await supabase
              .from('action_records')
              .insert({
                prompt_run_id: promptRunId,
                project_id: projectData.id,
                action_type: 'set_future_reminder',
                action_payload: {
                  days_until_check: actionData.days_until_check,
                  check_reason: actionData.check_reason || 'Follow-up check',
                  description: actionData.description || `Check project in ${actionData.days_until_check} days`
                },
                requires_approval: true,
                status: 'pending'
              })
              .select()
              .single();
            
            if (actionError) {
              console.error('Error creating reminder action record:', actionError);
            } else {
              actionRecordId = actionRecord.id;
              console.log('Created reminder action record:', actionRecord);
              
              aiResponse = aiResponse.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing action data:', parseError);
      }
    }

    console.log('Final AI response returned:', aiResponse);
    return new Response(JSON.stringify({ 
      reply: aiResponse,
      projectData: projectData,
      actionRecordId: actionRecordId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error in agent-chat function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function searchKnowledgeBase(supabase, companyId, query) {
  try {
    const embedding = await generateEmbedding(query);
    
    if (!embedding) {
      console.log('Could not generate embedding for search query');
      return [];
    }
    
    const { data, error } = await supabase.rpc('match_knowledge_embeddings', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
      company_id: companyId
    });
    
    if (error) {
      console.error('Error searching knowledge base:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in knowledge base search:', error);
    return [];
  }
}

async function generateEmbedding(text) {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OpenAI API key is not configured');
      return null;
    }
    
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
      return null;
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error('Error generating search embedding:', error);
    return null;
  }
}

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
  const claudeMessages = messages.map(msg => ({
    role: msg.role === 'system' ? 'user' : msg.role,
    content: msg.content
  }));
  
  if (messages.find(msg => msg.role === 'system')) {
    const firstUserIndex = claudeMessages.findIndex(msg => msg.role === 'user');
    if (firstUserIndex >= 0) {
      claudeMessages[firstUserIndex].content = 
        `${messages.find(msg => msg.role === 'system').content}\n\nUser message: ${claudeMessages[firstUserIndex].content}`;
    }
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
