import { handleEscalation } from "../database/handlers/escalationHandler.ts";

export async function handlePromptRequest(
  supabase: any,
  requestBody: any,
  userProfile: any,
  companyId: string | null
): Promise<any> {
  try {
    // Check if this is an escalation processing request
    if (requestBody.action_type === 'process_escalation') {
      console.log("Processing escalation request:", requestBody);
      
      const { action_record_id, project_id } = requestBody;
      
      if (!action_record_id || !project_id) {
        return {
          status: "error",
          error: "Missing action_record_id or project_id for escalation processing"
        };
      }

      // Call the escalation handler
      const escalationResult = await handleEscalation(
        supabase,
        null, // No prompt run ID for direct escalation processing
        project_id,
        { 
          reason: "Direct escalation processing",
          description: "Processing escalation from action record"
        }
      );

      return escalationResult;
    }

    const { prompt, project_id: projectId, prompt_run_id: promptRunId } = requestBody;

    if (!prompt || !projectId || !promptRunId) {
      console.error("Missing required parameters");
      return {
        status: "error",
        error: "Missing required parameters"
      };
    }

    console.log(`Received prompt: ${prompt} for project ${projectId}`);

    // Get project details for context
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id,
        project_name,
        summary,
        next_step,
        Address,
        companies(name, id)
      `)
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project data:", projectError);
      return {
        status: "error",
        error: "Failed to fetch project data"
      };
    }

    // Get the company settings
    const { data: companySettings, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', projectData?.companies?.id)
      .single();

    if (companyError) {
      console.error("Error fetching company settings:", companyError);
      return {
        status: "error",
        error: "Failed to fetch company settings"
      };
    }

    // Construct the prompt with project details
    const fullPrompt = `
      You are an AI project manager. Your goal is to help manage roofing and solar projects.
      You have access to project details and can create action records to manage the project.
      
      Project Name: ${projectData.project_name}
      Project Summary: ${projectData.summary}
      Project Next Step: ${projectData.next_step}
      Project Address: ${projectData.Address}
      
      Company Name: ${projectData.companies.name}
      
      ${companySettings?.ai_prompt_context || ''}
      
      Based on the above information, respond to the following prompt:
      ${prompt}
    `;

    // Call the OpenAI API
    const openAiUrl = "https://api.openai.com/v1/chat/completions";
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiApiKey) {
      console.error("OPENAI_API_KEY is not set");
      return {
        status: "error",
        error: "OPENAI_API_KEY is not set"
      };
    }

    const openAiBody = {
      model: "gpt-4",
      messages: [{ role: "user", content: fullPrompt }],
      temperature: 0.7,
    };

    const openAiResponse = await fetch(openAiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify(openAiBody),
    });

    const openAiData = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error("OpenAI API error:", openAiData);
      return {
        status: "error",
        error: "OpenAI API error",
        details: openAiData
      };
    }

    const responseText = openAiData.choices[0].message.content;
    console.log(`Received response: ${responseText}`);

    return {
      status: "success",
      response: responseText
    };
  } catch (error) {
    console.error("Error in handlePromptRequest:", error);
    return {
      status: "error",
      error: error.message || "An unexpected error occurred"
    };
  }
}
