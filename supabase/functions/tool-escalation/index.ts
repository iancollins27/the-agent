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

    const { reason, description, escalation_details, project_id } = args;

    if (!reason || !project_id) {
      return new Response(
        JSON.stringify(errorResponse('Missing required fields', 'reason and project_id are required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[tool-escalation] Creating escalation for project: ${project_id}, reason: ${reason}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify project exists and belongs to company
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, project_name, company_id, summary, next_step, "Address"')
      .eq('id', project_id)
      .eq('company_id', securityContext.company_id)
      .single();

    if (projectError || !projectData) {
      return new Response(
        JSON.stringify(errorResponse('Project not found or access denied')),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create escalation action record
    const actionData = {
      action_type: 'escalation',
      project_id,
      prompt_run_id: metadata?.prompt_run_id || null,
      requires_approval: false,
      action_payload: {
        reason: reason || 'Project requires escalation',
        description: description || 'Project has been escalated for manager review',
        escalation_details: escalation_details || 'No specific details provided',
        project_details: {
          name: projectData.project_name,
          address: projectData.Address,
          summary: projectData.summary,
          next_step: projectData.next_step
        }
      },
      status: 'pending'
    };

    const { data: actionRecord, error: actionError } = await supabase
      .from('action_records')
      .insert(actionData)
      .select()
      .single();

    if (actionError) {
      console.error('[tool-escalation] Error creating action record:', actionError);
      return new Response(
        JSON.stringify(errorResponse(actionError.message, 'Failed to create escalation')),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[tool-escalation] Created action record: ${actionRecord.id}`);

    // Trigger escalation handler
    try {
      const { error: handlerError } = await supabase.functions.invoke('test-workflow-prompt', {
        body: {
          action_type: 'process_escalation',
          action_record_id: actionRecord.id,
          project_id
        }
      });

      if (handlerError) {
        console.error('[tool-escalation] Handler error:', handlerError);
      }
    } catch (handlerError) {
      console.error('[tool-escalation] Exception triggering handler:', handlerError);
    }

    return new Response(
      JSON.stringify(successResponse({
        action_record_id: actionRecord.id,
        project_name: projectData.project_name
      }, `Escalation created for project ${projectData.project_name}. Notifications will be sent.`)),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tool-escalation] Error:', error);
    return new Response(
      JSON.stringify(errorResponse(error.message || 'Unknown error')),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
