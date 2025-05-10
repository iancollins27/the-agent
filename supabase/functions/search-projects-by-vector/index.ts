
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
        project_name,
        search_vector
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
    console.log(`Project IDs: ${projects.map(p => p.id).join(', ').substring(0, 100)}...`);
    
    // Check how many projects actually have usable vectors
    let validVectorCount = 0;
    projects.forEach((project, i) => {
      if (i < 5) {
        console.log(`Project ${i+1} (${project.id}) search_vector type: ${typeof project.search_vector}`);
        if (project.search_vector) {
          console.log(`Project ${i+1} search_vector preview: ${typeof project.search_vector === 'string' ? 
            project.search_vector.substring(0, 50) : 'non-string type'}`);
          validVectorCount++;
        }
      }
    });
    console.log(`Projects with valid vectors: ${validVectorCount} of ${projects.length}`);

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
        // Parse the search_vector if it's a string (PostgreSQL vector format)
        let projectVector = project.search_vector;
        
        if (typeof projectVector === 'string') {
          try {
            // Handle PostgreSQL vector format: '[0.1,0.2,0.3]'
            if (projectVector.startsWith('[') && projectVector.endsWith(']')) {
              projectVector = JSON.parse(projectVector);
            } 
            // Handle other potential formats
            else {
              console.log(`Unusual vector format for project ${project.id}, trying to parse...`);
              // Try to extract numbers from the string
              projectVector = projectVector
                .replace(/[^0-9,.\-]/g, '')
                .split(',')
                .map(num => parseFloat(num));
            }
          } catch (e) {
            console.error(`Failed to parse vector for project ${project.id}:`, e);
            continue;
          }
        }
        
        if (!Array.isArray(projectVector)) {
          console.error(`Project ${project.id} has invalid vector format: ${typeof projectVector}`);
          continue;
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
        totalProjects: projects.length,
        message: `Found ${finalResults.length} project(s) using vector search out of ${projects.length} projects with vectors`
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
