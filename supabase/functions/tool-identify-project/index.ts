import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ToolRequest, ToolResponse, successResponse, errorResponse } from '../_shared/tool-types/request-response.ts';
import { validateSecurityContext } from '../_shared/tool-types/security-context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function toLooseIlikePattern(input: string): string {
  const compact = input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '%')
    .replace(/%+/g, '%');

  return compact ? `%${compact}%` : `%${input}%`;
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) {
      console.error('[tool-identify-project] OPENAI_API_KEY not configured, skipping vector search');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });

    if (!response.ok) {
      console.error('[tool-identify-project] OpenAI embeddings API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('[tool-identify-project] Error generating embedding:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest = await req.json();

    // Validate security context
    const validation = validateSecurityContext(securityContext);
    if (!validation.valid) {
      return new Response(
        JSON.stringify(errorResponse(validation.error || 'Invalid security context')),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { query, type = 'any' } = args;

    if (!query) {
      return new Response(
        JSON.stringify(errorResponse('Query parameter is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[tool-identify-project] Query: "${query}", type: ${type}, company: ${securityContext.company_id}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // If user is a contact, fetch their allowed project IDs upfront
    // (needed for both text search filtering and vector fallback filtering)
    let allowedProjectIds: string[] | null = null;
    if (securityContext.user_type === 'contact' && securityContext.contact_id) {
      const { data: contactProjects, error: contactError } = await supabase
        .from('project_contacts')
        .select('project_id')
        .eq('contact_id', securityContext.contact_id);

      if (contactError) {
        console.error('[tool-identify-project] Error fetching contact projects:', contactError);
        return new Response(
          JSON.stringify(errorResponse('Failed to verify project access')),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      allowedProjectIds = contactProjects?.map(pc => pc.project_id) || [];
      if (allowedProjectIds.length === 0) {
        return new Response(
          JSON.stringify(successResponse({ projects: [], contacts: [], search_method: 'text' }, 'No projects accessible to this contact')),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // --- Text search ---
    let projectsQuery = supabase
      .from('projects')
      .select(`
        id,
        project_name,
        "Address",
        company_id,
        crm_id,
        summary,
        next_step,
        "Project_status",
        crm_status,
        project_manager
      `)
      .eq('company_id', securityContext.company_id);

    // Apply search based on type
    switch (type) {
      case 'id':
        projectsQuery = projectsQuery.eq('id', query);
        break;
      case 'crm_id':
        projectsQuery = projectsQuery.eq('crm_id', query);
        break;
      case 'name':
        projectsQuery = projectsQuery.ilike('project_name', `%${query}%`);
        break;
      case 'address':
        projectsQuery = projectsQuery.ilike('Address', toLooseIlikePattern(query));
        break;
      case 'any':
      default:
        // Check if query looks like a UUID
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidPattern.test(query)) {
          projectsQuery = projectsQuery.eq('id', query);
        } else {
          // Search across multiple fields
          projectsQuery = projectsQuery.or(`project_name.ilike.%${query}%,Address.ilike.%${query}%,crm_id.eq.${query}`);
        }
        break;
    }

    // Apply contact scoping to text search
    if (allowedProjectIds) {
      projectsQuery = projectsQuery.in('id', allowedProjectIds);
    }

    const { data: textResults, error: projectError } = await projectsQuery.limit(10);

    if (projectError) {
      console.error('[tool-identify-project] Error fetching projects:', projectError);
      return new Response(
        JSON.stringify(errorResponse(projectError.message)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let projects = textResults || [];
    let searchMethod = 'text';

    // --- Contact-name fallback ---
    // If user searched by a person name, map matched contacts to their projects.
    if (projects.length === 0 && ['any', 'name'].includes(type)) {
      const { data: contactProjectLinks, error: contactLookupError } = await supabase
        .from('project_contacts')
        .select(`
          project_id,
          contacts!inner (
            id,
            full_name
          )
        `)
        .ilike('contacts.full_name', `%${query}%`)
        .limit(50);

      if (!contactLookupError && contactProjectLinks && contactProjectLinks.length > 0) {
        let matchedProjectIds = [...new Set(contactProjectLinks.map((link: any) => link.project_id))];

        if (allowedProjectIds) {
          matchedProjectIds = matchedProjectIds.filter((id: string) => allowedProjectIds!.includes(id));
        }

        if (matchedProjectIds.length > 0) {
          const { data: projectMatches, error: projectMatchesError } = await supabase
            .from('projects')
            .select(`
              id,
              project_name,
              "Address",
              company_id,
              crm_id,
              summary,
              next_step,
              "Project_status",
              crm_status,
              project_manager
            `)
            .eq('company_id', securityContext.company_id)
            .in('id', matchedProjectIds)
            .limit(10);

          if (!projectMatchesError && projectMatches && projectMatches.length > 0) {
            projects = projectMatches;
            searchMethod = 'contact_name';
          }
        }
      }
    }

    // --- Vector fallback ---
    // Only for fuzzy search types when text search returns nothing
    if (projects.length === 0 && ['any', 'name', 'address'].includes(type)) {
      console.log(`[tool-identify-project] Text search returned 0 results, trying vector fallback for "${query}"`);

      const embedding = await generateEmbedding(query);
      if (embedding) {
        const { data: vectorResults, error: vectorError } = await supabase.rpc('search_projects_by_vector', {
          search_embedding: embedding,
          match_threshold: 0.3,
          match_count: 10,
          p_company_id: securityContext.company_id
        });

        if (vectorError) {
          console.error('[tool-identify-project] Vector search error:', vectorError);
          // Don't fail — just continue with empty results
        } else if (vectorResults && vectorResults.length > 0) {
          // Apply contact scoping to vector results
          let scopedResults = vectorResults;
          if (allowedProjectIds) {
            scopedResults = vectorResults.filter((r: any) => allowedProjectIds!.includes(r.id));
          }

          projects = scopedResults.map((r: any) => ({
            id: r.id,
            project_name: r.project_name,
            Address: r.Address,
            crm_id: r.crm_id,
            summary: r.summary,
            next_step: r.next_step,
            Project_status: r.Project_status,
            crm_status: r.crm_status,
            project_manager: r.project_manager,
            similarity: r.similarity
          }));
          searchMethod = 'vector';
          console.log(`[tool-identify-project] Vector fallback found ${projects.length} results`);
        }
      }
    }

    // Fetch contacts for found projects
    let contacts: any[] = [];
    if (projects.length > 0) {
      const projectIds = projects.map((p: any) => p.id);
      const { data: projectContacts, error: contactsError } = await supabase
        .from('project_contacts')
        .select(`
          project_id,
          contacts:contact_id (
            id,
            full_name,
            email,
            phone_number,
            role
          )
        `)
        .in('project_id', projectIds);

      if (!contactsError && projectContacts) {
        contacts = projectContacts;
      }
    }

    const result = {
      projects,
      contacts,
      query,
      type,
      search_method: searchMethod,
      count: projects.length
    };

    console.log(`[tool-identify-project] Found ${result.count} projects via ${searchMethod}`);

    return new Response(
      JSON.stringify(successResponse(result,
        result.count > 0
          ? `Found ${result.count} project(s) matching "${query}" (via ${searchMethod} search)`
          : `No projects found matching "${query}"`
      )),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tool-identify-project] Error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message || 'Unknown error')),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
