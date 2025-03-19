
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Running check-project-reminders function");
    
    // Get projects that are due for checking
    const { data: projectsDue, error: projectsError } = await supabase.rpc(
      'get_projects_due_for_check'
    );
    
    if (projectsError) {
      console.error("Error fetching projects due for check:", projectsError);
      throw new Error("Failed to fetch projects due for check");
    }
    
    console.log(`Found ${projectsDue?.length || 0} projects due for check`);
    
    // Track results for all project checks
    const results = [];
    
    // Process each project that's due for a check
    for (const project of projectsDue || []) {
      console.log(`Processing project ${project.id}`);
      
      try {
        // Get the appropriate workflow prompt for action detection
        const { data: prompt, error: promptError } = await supabase
          .from('workflow_prompts')
          .select('*')
          .eq('type', 'action_detection_execution')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (promptError) {
          console.error(`Error fetching workflow prompt for project ${project.id}:`, promptError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch workflow prompt"
          });
          continue;
        }
        
        // Get company name and project track info for context
        const { data: contextData, error: contextError } = await supabase
          .from('projects')
          .select(`
            id,
            summary,
            next_step,
            companies(name),
            project_track,
            project_tracks(name, description)
          `)
          .eq('id', project.id)
          .single();
          
        if (contextError) {
          console.error(`Error fetching context data for project ${project.id}:`, contextError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch project context data"
          });
          continue;
        }
        
        // Prepare context for the AI
        const context = {
          project_id: project.id,
          summary: contextData.summary,
          next_step: contextData.next_step,
          company_name: contextData.companies?.name,
          track_name: contextData.project_tracks?.name,
          track_description: contextData.project_tracks?.description,
          current_date: new Date().toISOString().split('T')[0],
          is_reminder_check: true
        };
        
        // Replace variables in the prompt
        let finalPrompt = prompt.prompt_text;
        for (const [key, value] of Object.entries(context)) {
          finalPrompt = finalPrompt.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
        }
        
        // Get AI configuration
        const { data: aiConfig, error: aiConfigError } = await supabase
          .from('ai_config')
          .select('provider, model')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
          
        if (aiConfigError) {
          console.error(`Error fetching AI config for project ${project.id}:`, aiConfigError);
          results.push({
            project_id: project.id,
            success: false,
            error: "Failed to fetch AI configuration"
          });
          continue;
        }
        
        // Get appropriate API key based on provider
        let apiKey;
        const aiProvider = aiConfig?.provider || 'openai';
        const aiModel = aiConfig?.model || 'gpt-4o';
        
        if (aiProvider === 'openai') {
          apiKey = Deno.env.get('OPENAI_API_KEY');
        } else if (aiProvider === 'claude') {
          apiKey = Deno.env.get('CLAUDE_API_KEY');
        } else if (aiProvider === 'deepseek') {
          apiKey = Deno.env.get('DEEPSEEK_API_KEY');
        }
        
        if (!apiKey) {
          console.error(`API key for ${aiProvider} is not configured`);
          results.push({
            project_id: project.id,
            success: false,
            error: `API key for ${aiProvider} is not configured`
          });
          continue;
        }
        
        // Log the prompt run
        const { data: promptRun, error: logError } = await supabase
          .from('prompt_runs')
          .insert({
            project_id: project.id,
            workflow_prompt_id: prompt.id,
            prompt_input: finalPrompt,
            status: 'PENDING',
            ai_provider: aiProvider,
            ai_model: aiModel
          })
          .select()
          .single();
          
        if (logError) {
          console.error(`Error logging prompt run for project ${project.id}:`, logError);
        }
        
        // Call AI to analyze the project and determine actions
        let aiResponse;
        try {
          let response;
          if (aiProvider === 'openai') {
            response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [{
                  role: 'user',
                  content: finalPrompt
                }],
                temperature: 0.7,
              }),
            });
          } else if (aiProvider === 'claude') {
            response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'X-API-Key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [{
                  role: 'user',
                  content: finalPrompt
                }],
                max_tokens: 1000,
                temperature: 0.7,
              }),
            });
          } else if (aiProvider === 'deepseek') {
            response = await fetch('https://api.deepseek.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: aiModel,
                messages: [{
                  role: 'user',
                  content: finalPrompt
                }],
                temperature: 0.7,
                max_tokens: 1000,
              }),
            });
          } else {
            throw new Error(`Unsupported AI provider: ${aiProvider}`);
          }
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(`API error: ${data.error?.message || JSON.stringify(data)}`);
          }
          
          aiResponse = aiProvider === 'claude' 
            ? data.content[0].text 
            : data.choices[0].message.content;
            
        } catch (error) {
          console.error(`Error calling AI for project ${project.id}:`, error);
          
          // Update the prompt run with the error
          if (promptRun?.id) {
            await supabase
              .from('prompt_runs')
              .update({
                error_message: error.message || 'Unknown error',
                status: 'ERROR',
                completed_at: new Date().toISOString()
              })
              .eq('id', promptRun.id);
          }
          
          results.push({
            project_id: project.id,
            success: false,
            error: `Error calling AI: ${error.message}`
          });
          continue;
        }
        
        // Update the prompt run with the response
        if (promptRun?.id) {
          await supabase
            .from('prompt_runs')
            .update({
              prompt_output: aiResponse,
              status: 'COMPLETED',
              completed_at: new Date().toISOString()
            })
            .eq('id', promptRun.id);
        }
        
        // Process the AI response to extract action data
        let actionData = null;
        try {
          const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            actionData = JSON.parse(jsonMatch[1].trim());
            console.log(`Extracted action data for project ${project.id}:`, actionData);
          }
        } catch (error) {
          console.error(`Error parsing action data for project ${project.id}:`, error);
        }
        
        // Create an action record based on the AI response
        if (actionData) {
          try {
            if (actionData.action_type === "set_future_reminder" && actionData.days_until_check) {
              // Calculate the next check date
              const nextCheckDate = new Date();
              nextCheckDate.setDate(nextCheckDate.getDate() + actionData.days_until_check);
              
              // Update the project with the new check date
              await supabase
                .from('projects')
                .update({
                  next_check_date: nextCheckDate.toISOString()
                })
                .eq('id', project.id);
              
              // Create an action record for the reminder
              await supabase
                .from('action_records')
                .insert({
                  prompt_run_id: promptRun?.id,
                  project_id: project.id,
                  action_type: 'set_future_reminder',
                  action_payload: {
                    days_until_check: actionData.days_until_check,
                    check_reason: actionData.check_reason || 'Follow-up check',
                    description: `Automatically set reminder to check in ${actionData.days_until_check} days: ${actionData.check_reason || 'Follow-up check'}`
                  },
                  status: 'executed',
                  requires_approval: false,
                  executed_at: new Date().toISOString()
                });
                
              console.log(`Set new reminder for project ${project.id} in ${actionData.days_until_check} days`);
            } else if (actionData.action_type === "data_update" && actionData.field_to_update) {
              // Create an action record for the data update (requiring approval)
              await supabase
                .from('action_records')
                .insert({
                  prompt_run_id: promptRun?.id,
                  project_id: project.id,
                  action_type: 'data_update',
                  action_payload: {
                    field: actionData.field_to_update,
                    value: actionData.new_value,
                    description: actionData.description || `Update ${actionData.field_to_update} to: ${actionData.new_value}`
                  },
                  requires_approval: true,
                  status: 'pending'
                });
                
              console.log(`Created data update action for project ${project.id}`);
            } else if (actionData.action_type === "message") {
              // Create an action record for the message (requiring approval)
              await supabase
                .from('action_records')
                .insert({
                  prompt_run_id: promptRun?.id,
                  project_id: project.id,
                  action_type: 'message',
                  action_payload: {
                    recipient: actionData.recipient,
                    message_content: actionData.message_content,
                    description: actionData.description || `Send message to ${actionData.recipient}`
                  },
                  requires_approval: true,
                  status: 'pending'
                });
                
              console.log(`Created message action for project ${project.id}`);
            } else if (actionData.action_type === "no_action") {
              // Clear the next_check_date since we've checked and no action is needed
              await supabase
                .from('projects')
                .update({
                  next_check_date: null,
                  last_action_check: new Date().toISOString()
                })
                .eq('id', project.id);
                
              // Create an action record for documentation
              await supabase
                .from('action_records')
                .insert({
                  prompt_run_id: promptRun?.id,
                  project_id: project.id,
                  action_type: 'no_action',
                  action_payload: {
                    description: actionData.description || 'No action needed at this time'
                  },
                  status: 'executed',
                  requires_approval: false,
                  executed_at: new Date().toISOString()
                });
                
              console.log(`No action needed for project ${project.id}, cleared next_check_date`);
            }
            
            results.push({
              project_id: project.id,
              success: true,
              action_type: actionData.action_type
            });
          } catch (error) {
            console.error(`Error creating action record for project ${project.id}:`, error);
            results.push({
              project_id: project.id,
              success: false,
              error: `Error creating action record: ${error.message}`
            });
          }
        } else {
          // If no action data was extracted, clear the next_check_date and update last_action_check
          await supabase
            .from('projects')
            .update({
              next_check_date: null,
              last_action_check: new Date().toISOString()
            })
            .eq('id', project.id);
            
          results.push({
            project_id: project.id,
            success: true,
            action_type: 'no_action_extracted'
          });
          
          console.log(`No action data extracted for project ${project.id}, cleared next_check_date`);
        }
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        results.push({
          project_id: project.id,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        projects_processed: projectsDue?.length || 0,
        results
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in check-project-reminders function:", error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
