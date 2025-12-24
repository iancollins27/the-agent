/**
 * Tool Edge Function: crm-write
 * Writes data to the CRM system
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

interface CrmWriteArgs {
  project_id: string;
  resource_type: 'project' | 'task' | 'note' | 'contact';
  operation_type: 'create' | 'update' | 'delete';
  resource_id?: string;
  data: Record<string, unknown>;
  requires_approval?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest<CrmWriteArgs> = await req.json();
    
    console.log(`tool-crm-write called by ${metadata?.orchestrator || 'unknown'}`);
    
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
    
    // Verify project belongs to company
    const projectId = securityContext.project_id || args.project_id;
    if (!projectId) {
      return new Response(
        JSON.stringify(errorResponse('project_id is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, company_id')
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
    
    // For update/delete, resource_id is required
    if ((args.operation_type === 'update' || args.operation_type === 'delete') && !args.resource_id) {
      return new Response(
        JSON.stringify(errorResponse(`resource_id is required for ${args.operation_type} operations`)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Default to requiring approval
    const requiresApproval = args.requires_approval !== false;
    
    if (requiresApproval) {
      // Create an action record for approval
      const { data: actionRecord, error: actionError } = await supabase
        .from('action_records')
        .insert({
          project_id: projectId,
          prompt_run_id: metadata?.prompt_run_id || null,
          action_type: 'crm_write',
          requires_approval: true,
          status: 'pending',
          action_payload: {
            resource_type: args.resource_type,
            operation_type: args.operation_type,
            resource_id: args.resource_id,
            data: args.data,
            company_id: project.company_id,
            description: `${args.operation_type} ${args.resource_type} in CRM`
          },
          message: `${args.operation_type} ${args.resource_type}: ${JSON.stringify(args.data).substring(0, 100)}`
        })
        .select('id')
        .single();
        
      if (actionError) {
        return new Response(
          JSON.stringify(errorResponse(`Failed to create action record: ${actionError.message}`)),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify(successResponse(
          { action_record_id: actionRecord.id, requires_approval: true },
          `Created action record for CRM write (${args.operation_type} ${args.resource_type}). Waiting for approval.`
        )),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Execute immediately (no approval needed)
    const { data: job, error: jobError } = await supabase
      .from('integration_job_queue')
      .insert({
        company_id: project.company_id,
        project_id: projectId,
        operation_type: args.operation_type === 'delete' ? 'delete' : 'write',
        resource_type: args.resource_type,
        payload: {
          resourceType: args.resource_type,
          resourceId: args.resource_id,
          data: args.data,
          operationType: args.operation_type
        },
        status: 'pending'
      })
      .select('id')
      .single();
      
    if (jobError) {
      return new Response(
        JSON.stringify(errorResponse(`Failed to create integration job: ${jobError.message}`)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(successResponse(
        { job_id: job.id, requires_approval: false },
        `Created integration job for CRM write (${args.operation_type} ${args.resource_type})`
      )),
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
