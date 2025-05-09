
/**
 * Edge function to generate and update vector embeddings for projects
 * Can be run:
 * - On-demand for a specific project
 * - As a batch job to update all projects
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Parse request body
    const { projectId, batchSize, processAll } = await req.json();
    
    // Validate inputs
    if (!processAll && !projectId) {
      return new Response(
        JSON.stringify({ error: "Either projectId or processAll must be provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    // If processing a single project
    if (projectId) {
      const result = await updateProjectEmbedding(supabaseClient, projectId);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // If processing all projects
    if (processAll) {
      const limit = batchSize || 50;
      const result = await updateAllProjectEmbeddings(supabaseClient, limit);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

/**
 * Generate and update the embedding for a specific project
 */
async function updateProjectEmbedding(supabase, projectId) {
  // Get project data
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, project_name, "Address", summary, crm_id')
    .eq('id', projectId)
    .single();
    
  if (projectError || !project) {
    console.error("Error fetching project:", projectError);
    return { success: false, error: projectError?.message || "Project not found" };
  }
  
  // Generate searchable text
  const searchText = [
    project.project_name,
    project.Address,
    project.summary,
    project.crm_id
  ].filter(Boolean).join(' ');
  
  if (!searchText.trim()) {
    return { 
      success: false, 
      error: "No searchable text available for this project",
      projectId
    };
  }
  
  // Generate embedding
  const embedding = await generateOpenAIEmbedding(searchText);
  
  // Update project with new embedding
  const { error: updateError } = await supabase
    .from('projects')
    .update({ search_vector: embedding })
    .eq('id', projectId);
    
  if (updateError) {
    console.error("Error updating project embedding:", updateError);
    return { success: false, error: updateError.message, projectId };
  }
  
  return {
    success: true,
    projectId,
    message: "Project embedding updated successfully"
  };
}

/**
 * Update embeddings for all projects that need updating
 */
async function updateAllProjectEmbeddings(supabase, limit) {
  // Get projects without embeddings, limited by batch size
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id')
    .is('search_vector', null)
    .limit(limit);
    
  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return { success: false, error: projectsError.message };
  }
  
  if (!projects || projects.length === 0) {
    return { success: true, message: "No projects found that need embeddings" };
  }
  
  // Update embeddings for each project
  const results = [];
  for (const project of projects) {
    try {
      const result = await updateProjectEmbedding(supabase, project.id);
      results.push(result);
    } catch (error) {
      console.error(`Error updating project ${project.id}:`, error);
      results.push({
        success: false,
        projectId: project.id,
        error: error.message || "Unknown error"
      });
    }
  }
  
  return {
    success: true,
    processed: results.length,
    results,
    message: `Processed ${results.length} projects`
  };
}

/**
 * Generate an embedding using OpenAI's API
 */
async function generateOpenAIEmbedding(text) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-ada-002"
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
