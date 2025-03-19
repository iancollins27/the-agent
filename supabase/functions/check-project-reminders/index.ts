
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for projects with reminders due today...");

    // Get the current date in ISO format, without time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    console.log(`Checking for projects with next_check_date before ${tomorrow}`);

    // Query for projects that have a next_check_date before tomorrow
    const { data: projectsDue, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .lt("next_check_date", tomorrow)
      .order("next_check_date", { ascending: true });

    if (projectsError) {
      throw projectsError;
    }

    console.log(`Found ${projectsDue?.length || 0} projects with reminders due`);

    // Process each project that has a reminder due
    const results = [];
    for (const project of projectsDue || []) {
      console.log(`Processing project ${project.id} with next_check_date: ${project.next_check_date}`);
      
      try {
        // Get the action detection prompt
        const { data: promptData, error: promptError } = await supabase
          .from("workflow_prompts")
          .select("*")
          .eq("type", "action_detection_execution")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (promptError) {
          console.error("Error fetching prompt:", promptError);
          results.push({ projectId: project.id, status: "error", error: promptError.message });
          continue;
        }

        // Get the project track name if available
        let trackName = null;
        if (project.project_track) {
          const { data: trackData } = await supabase
            .from("project_tracks")
            .select("name")
            .eq("id", project.project_track)
            .single();
          
          if (trackData) {
            trackName = trackData.name;
          }
        }

        // Get milestone instructions if next step exists
        let milestoneInstructions = null;
        if (project.next_step && project.project_track) {
          const { data: milestoneData } = await supabase
            .from("project_track_milestones")
            .select("instructions")
            .eq("project_track_id", project.project_track)
            .eq("name", project.next_step)
            .single();
          
          if (milestoneData) {
            milestoneInstructions = milestoneData.instructions;
          }
        }

        // Calculate days since the last check
        const lastCheckDate = project.last_action_check ? new Date(project.last_action_check) : null;
        const daysSinceLastCheck = lastCheckDate ? 
          Math.floor((now.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60 * 24)) : 
          null;

        // Get the company id of the project for later use
        const companyId = project.company_id;

        // Prepare context data for the prompt
        const contextData = {
          summary: project.summary,
          track_name: trackName,
          current_date: now.toISOString().split('T')[0],
          next_step: project.next_step,
          milestone_instructions: milestoneInstructions,
          next_check_date: project.next_check_date,
          days_since_last_check: daysSinceLastCheck
        };

        // Get AI configuration to use the most recent model
        const { data: aiConfig, error: aiConfigError } = await supabase
          .from("ai_config")
          .select("provider, model")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        const aiProvider = aiConfig?.provider || "openai";
        const aiModel = aiConfig?.model || "gpt-4o";

        console.log(`Using AI provider: ${aiProvider}, model: ${aiModel}`);

        // Call the test-workflow-prompt function to process this project
        const { data: testResult, error: testError } = await supabase.functions.invoke("test-workflow-prompt", {
          body: {
            promptType: "action_detection_execution",
            promptText: promptData.prompt_text,
            projectId: project.id,
            contextData,
            aiProvider,
            aiModel,
            workflowPromptId: promptData.id,
            initiatedBy: "automatic_reminder"
          }
        });

        if (testError) {
          console.error("Error calling test-workflow-prompt:", testError);
          results.push({ projectId: project.id, status: "error", error: testError.message });
          continue;
        }

        // Update the project's last_action_check date
        const { error: updateError } = await supabase
          .from("projects")
          .update({ 
            last_action_check: now.toISOString(),
            next_check_date: null // Reset the next_check_date since we've processed it
          })
          .eq("id", project.id);

        if (updateError) {
          console.error("Error updating project last_action_check:", updateError);
        }

        results.push({
          projectId: project.id,
          status: "success",
          actionRecordId: testResult.actionRecordId,
          promptRunId: testResult.promptRunId
        });

        console.log(`Successfully processed project ${project.id}`);
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        results.push({ projectId: project.id, status: "error", error: error.message });
      }
    }

    console.log("Finished processing all due reminders");

    return new Response(
      JSON.stringify({
        message: `Processed ${projectsDue?.length || 0} projects with reminders due`,
        results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in check-project-reminders function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
