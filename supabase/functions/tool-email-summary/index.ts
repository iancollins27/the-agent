/**
 * Tool Edge Function: email-summary
 * Generates or updates email summaries for a project
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

interface EmailSummaryArgs {
  project_id: string;
  days_lookback?: number;
  append_mode?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { securityContext, args, metadata }: ToolRequest<EmailSummaryArgs> = await req.json();
    
    console.log(`tool-email-summary called by ${metadata?.orchestrator || 'unknown'}`);
    
    // Validate security context
    const validation = validateSecurityContext(securityContext);
    if (!validation.valid) {
      return new Response(
        JSON.stringify(errorResponse(validation.error!)),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const projectId = securityContext.project_id || args.project_id;
    if (!projectId) {
      return new Response(
        JSON.stringify(errorResponse('project_id is required')),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Verify project belongs to company
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
    
    // Call the existing email-summary edge function
    const { data, error } = await supabase.functions.invoke('email-summary', {
      body: {
        project_id: projectId,
        company_id: securityContext.company_id,
        days_lookback: args.days_lookback || 7,
        append_mode: args.append_mode !== false
      }
    });
    
    if (error) {
      console.error('Email summary function error:', error);
      return new Response(
        JSON.stringify(errorResponse(`Email summary failed: ${error.message}`)),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify(successResponse(data, 'Email summary processed successfully')),
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
