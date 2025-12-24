import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { ToolRequest, ToolResponse, successResponse, errorResponse } from '../_shared/tool-types/request-response.ts';
import { validateSecurityContext } from '../_shared/tool-types/security-context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        projectsQuery = projectsQuery.ilike('Address', `%${query}%`);
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

    // If user is a contact, further filter to only their projects
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

      const allowedProjectIds = contactProjects?.map(pc => pc.project_id) || [];
      if (allowedProjectIds.length === 0) {
        return new Response(
          JSON.stringify(successResponse({ projects: [], contacts: [] }, 'No projects accessible to this contact')),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      projectsQuery = projectsQuery.in('id', allowedProjectIds);
    }

    const { data: projects, error: projectError } = await projectsQuery.limit(10);

    if (projectError) {
      console.error('[tool-identify-project] Error fetching projects:', projectError);
      return new Response(
        JSON.stringify(errorResponse(projectError.message)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contacts for found projects
    let contacts: any[] = [];
    if (projects && projects.length > 0) {
      const projectIds = projects.map(p => p.id);
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
      projects: projects || [],
      contacts,
      query,
      type,
      count: projects?.length || 0
    };

    console.log(`[tool-identify-project] Found ${result.count} projects`);

    return new Response(
      JSON.stringify(successResponse(result, 
        result.count > 0 
          ? `Found ${result.count} project(s) matching "${query}"` 
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
