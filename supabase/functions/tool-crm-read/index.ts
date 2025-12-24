/**
 * Tool Edge Function: crm-read
 * Reads data from the CRM system for projects
 * 
 * Used by: test-workflow-prompt
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import {
  ToolRequest,
  ToolResponse,
  validateSecurityContext,
  successResponse,
  errorResponse
} from '../_shared/tool-types/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrmReadArgs {
  resource_type: 'project' | 'contact' | 'activity' | 'note';
  project_id?: string;
  crm_id?: string;
  limit?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest<CrmReadArgs> = await req.json();
    
    console.log(`tool-crm-read called by ${metadata?.orchestrator || 'unknown'}`);
    
    // Validate security context
    const validation = validateSecurityContext(securityContext);
    if (!validation.valid) {
      return new Response(
        JSON.stringify(errorResponse(validation.error!)),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const projectId = securityContext.project_id || args.project_id;
    
    // If project_id provided, verify it belongs to the company
    if (projectId) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, company_id, crm_id')
        .eq('id', projectId)
        .single();
        
      if (projectError || !project) {
        return new Response(
          JSON.stringify(errorResponse('Project not found')),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (project.company_id !== securityContext.company_id) {
        return new Response(
          JSON.stringify(errorResponse('Access denied')),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Execute based on resource type
    const result = await readCrmData(supabase, securityContext.company_id, args, projectId);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Tool error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message)),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function readCrmData(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  args: CrmReadArgs,
  projectId?: string
): Promise<ToolResponse> {
  const limit = args.limit || 50;
  
  switch (args.resource_type) {
    case 'project':
      return await readProjectData(supabase, companyId, projectId, args.crm_id);
      
    case 'contact':
      return await readContactData(supabase, companyId, projectId, limit);
      
    case 'note':
      return await readNoteData(supabase, projectId, limit);
      
    case 'activity':
      return await readActivityData(supabase, projectId, limit);
      
    default:
      return errorResponse(`Unknown resource type: ${args.resource_type}`);
  }
}

async function readProjectData(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  projectId?: string,
  crmId?: string
): Promise<ToolResponse> {
  let query = supabase
    .from('projects')
    .select('id, crm_id, project_name, Address, summary, next_step, Project_status, crm_status, company_id, created_at')
    .eq('company_id', companyId);
    
  if (projectId) {
    query = query.eq('id', projectId);
  } else if (crmId) {
    query = query.eq('crm_id', crmId);
  }
  
  const { data, error } = await query.limit(10);
  
  if (error) {
    return errorResponse(`Failed to read projects: ${error.message}`);
  }
  
  return successResponse({ projects: data }, `Found ${data?.length || 0} projects`);
}

async function readContactData(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  projectId?: string,
  limit: number = 50
): Promise<ToolResponse> {
  if (projectId) {
    // Get contacts for specific project
    const { data: projectContacts, error: pcError } = await supabase
      .from('project_contacts')
      .select('contact_id')
      .eq('project_id', projectId);
      
    if (pcError) {
      return errorResponse(`Failed to read project contacts: ${pcError.message}`);
    }
    
    if (!projectContacts || projectContacts.length === 0) {
      return successResponse({ contacts: [] }, 'No contacts found for this project');
    }
    
    const contactIds = projectContacts.map(pc => pc.contact_id);
    
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, full_name, email, phone_number, role')
      .in('id', contactIds)
      .limit(limit);
      
    if (error) {
      return errorResponse(`Failed to read contacts: ${error.message}`);
    }
    
    return successResponse({ contacts }, `Found ${contacts?.length || 0} contacts`);
  } else {
    // Get contacts for company
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, full_name, email, phone_number, role')
      .eq('company_id', companyId)
      .limit(limit);
      
    if (error) {
      return errorResponse(`Failed to read contacts: ${error.message}`);
    }
    
    return successResponse({ contacts }, `Found ${contacts?.length || 0} contacts`);
  }
}

async function readNoteData(
  supabase: ReturnType<typeof createClient>,
  projectId?: string,
  limit: number = 50
): Promise<ToolResponse> {
  if (!projectId) {
    return errorResponse('project_id is required for reading notes');
  }
  
  // Read from action_records where action_type = 'note' or similar
  const { data: notes, error } = await supabase
    .from('action_records')
    .select('id, message, action_payload, created_at')
    .eq('project_id', projectId)
    .in('action_type', ['note', 'crm_write'])
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    return errorResponse(`Failed to read notes: ${error.message}`);
  }
  
  return successResponse({ notes }, `Found ${notes?.length || 0} notes`);
}

async function readActivityData(
  supabase: ReturnType<typeof createClient>,
  projectId?: string,
  limit: number = 50
): Promise<ToolResponse> {
  if (!projectId) {
    return errorResponse('project_id is required for reading activities');
  }
  
  // Read communications as activities
  const { data: activities, error } = await supabase
    .from('communications')
    .select('id, type, subtype, direction, content, timestamp, participants')
    .eq('project_id', projectId)
    .order('timestamp', { ascending: false })
    .limit(limit);
    
  if (error) {
    return errorResponse(`Failed to read activities: ${error.message}`);
  }
  
  return successResponse({ activities }, `Found ${activities?.length || 0} activities`);
}
