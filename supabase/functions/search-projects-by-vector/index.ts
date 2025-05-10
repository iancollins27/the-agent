
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get request body
    const { searchEmbedding, matchThreshold = 0.2, matchCount = 5, companyId = null } = await req.json();
    
    if (!searchEmbedding) {
      return new Response(
        JSON.stringify({ error: 'Search embedding is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("Received search vector request with parameters:", {
      matchThreshold,
      matchCount,
      hasCompanyId: companyId !== null,
      embeddingSize: Array.isArray(searchEmbedding) ? searchEmbedding.length : 'Not an array'
    });

    // Build the query
    let query = supabase
      .from('projects')
      .select(`
        id,
        crm_id,
        summary,
        next_step,
        company_id,
        companies(name),
        "Address",
        "Project_status",
        project_name
      `)
      .not('search_vector', 'is', null);
    
    // Add company filter if provided
    if (companyId) {
      console.log(`Filtering by company_id: ${companyId}`);
      query = query.eq('company_id', companyId);
    }
    
    // Execute the query to get projects with search vectors
    const { data: projects, error } = await query.limit(matchCount);
    
    if (error) {
      console.error("Error fetching projects:", error);
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!projects || projects.length === 0) {
      console.log("No projects found with search vectors");
      return new Response(
        JSON.stringify({ projects: [], found: false, message: "No projects found with search vectors" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${projects.length} projects with search vectors`);

    // Function to calculate cosine similarity between vectors
    const calculateCosineSimilarity = (vec1, vec2) => {
      if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
        console.error("Invalid vectors for similarity calculation", { 
          vec1Length: Array.isArray(vec1) ? vec1.length : typeof vec1,
          vec2Length: Array.isArray(vec2) ? vec2.length : typeof vec2
        });
        return 0;
      }
      
      let dotProduct = 0;
      let mag1 = 0;
      let mag2 = 0;
      
      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
      }
      
      mag1 = Math.sqrt(mag1);
      mag2 = Math.sqrt(mag2);
      
      if (mag1 === 0 || mag2 === 0) return 0;
      
      const similarity = dotProduct / (mag1 * mag2);
      return similarity;
    };

    // Calculate similarity scores for each project
    const projectsWithScores = [];
    
    for (const project of projects) {
      try {
        // Fetch the search_vector for this project
        const { data: vectorData, error: vectorError } = await supabase
          .from('projects')
          .select('search_vector')
          .eq('id', project.id)
          .single();
        
        if (vectorError) {
          console.error(`Error fetching vector for project ${project.id}:`, vectorError);
          continue;
        }
        
        if (!vectorData || !vectorData.search_vector) {
          console.log(`No search vector found for project ${project.id}`);
          continue;
        }
        
        // Convert PostgreSQL vector format to JS array if needed
        let projectVector = vectorData.search_vector;
        if (typeof projectVector === 'string' && projectVector.startsWith('[') && projectVector.endsWith(']')) {
          try {
            projectVector = JSON.parse(projectVector);
          } catch (e) {
            console.error(`Failed to parse vector for project ${project.id}:`, e);
            continue;
          }
        }
        
        // Calculate similarity
        const similarity = calculateCosineSimilarity(searchEmbedding, projectVector);
        console.log(`Project ${project.id} similarity score: ${similarity}`);
        
        // Only include projects above the threshold
        if (similarity >= matchThreshold) {
          projectsWithScores.push({
            id: project.id,
            crm_id: project.crm_id || '',
            summary: project.summary || '',
            next_step: project.next_step || '',
            company_id: project.company_id,
            company_name: project.companies?.name || '',
            address: project.Address || '',
            status: project.Project_status || '',
            project_name: project.project_name || '',
            similarity: similarity
          });
        }
      } catch (projectError) {
        console.error(`Error processing project ${project.id}:`, projectError);
      }
    }
    
    // Sort by similarity (highest first)
    projectsWithScores.sort((a, b) => b.similarity - a.similarity);
    
    // Limit results
    const finalResults = projectsWithScores.slice(0, matchCount);
    
    console.log(`Returning ${finalResults.length} projects with similarity scores`);
    
    // Log the structure of the first result for debugging
    if (finalResults.length > 0) {
      console.log("Sample result structure:", 
        Object.entries(finalResults[0]).map(([key, value]) => `${key}: ${typeof value}`));
    }
    
    return new Response(
      JSON.stringify({
        status: "success",
        projects: finalResults,
        found: finalResults.length > 0,
        count: finalResults.length,
        message: `Found ${finalResults.length} project(s) using vector search`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-projects-by-vector function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
