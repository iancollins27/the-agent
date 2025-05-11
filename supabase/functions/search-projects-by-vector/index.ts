
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
    const { searchEmbedding, matchThreshold = 0.2, matchCount = 20, companyId = null } = await req.json();
    
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

    // Count total projects with search vectors
    const { count: totalProjectsWithVectors, error: countError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: false })
      .not('search_vector', 'is', null);
      
    if (countError) {
      console.error("Error counting projects with vectors:", countError);
    } else {
      console.log(`Total projects with search vectors in database: ${totalProjectsWithVectors}`);
    }

    // Call the SQL function using RPC
    const { data: projectsWithScores, error } = await supabase.rpc(
      'search_projects_by_vector',
      {
        search_embedding: searchEmbedding,
        match_threshold: matchThreshold,
        match_count: matchCount,
        p_company_id: companyId
      }
    );
    
    if (error) {
      console.error("Error executing vector search:", error);
      return new Response(
        JSON.stringify({ error: `Database error: ${error.message}`, details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!projectsWithScores || projectsWithScores.length === 0) {
      console.log("No projects found with vector similarity above threshold");
      return new Response(
        JSON.stringify({ 
          projects: [], 
          found: false, 
          message: "No projects found with sufficient similarity" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${projectsWithScores.length} projects with vector similarity`);
    
    // Log the raw structure of the first result to debug type issues
    if (projectsWithScores.length > 0) {
      console.log("Sample raw result from database:", 
        Object.entries(projectsWithScores[0]).map(([key, value]) => `${key}: ${typeof value} (${value})`));
    }
    
    // Format the results to match the expected structure - ensuring all values are correctly typed
    const formattedResults = projectsWithScores.map(project => ({
      id: project.id,
      crm_id: project.crm_id || '',
      summary: project.summary || '',
      next_step: project.next_step || '',
      company_id: project.company_id,
      company_name: project.company_name || '',
      address: project.address || '',
      status: project.status || '',
      project_name: project.project_name || '',
      project_track: project.project_track,
      similarity: project.similarity
    }));
    
    // Log a sample of the first result
    if (formattedResults.length > 0) {
      console.log("Sample formatted result structure:", 
        Object.entries(formattedResults[0]).map(([key, value]) => `${key}: ${typeof value}`));
      
      // Log some similarity scores for debugging
      formattedResults.slice(0, 5).forEach((project, idx) => {
        console.log(`Project ${idx+1} (${project.id}) similarity score: ${project.similarity}`);
      });
    }
    
    return new Response(
      JSON.stringify({
        status: "success",
        projects: formattedResults,
        found: formattedResults.length > 0,
        count: formattedResults.length,
        message: `Found ${formattedResults.length} project(s) using vector search`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in search-projects-by-vector function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred", stack: error.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
