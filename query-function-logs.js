// Query recent edge function logs from Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read MCP config
const userProfile = process.env.USERPROFILE || process.env.HOME;
const mcpConfigPath = path.join(userProfile, '.cursor', 'mcp.json');
const config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));

const supabase = createClient(
  config.mcpServers.supabase.env.SUPABASE_URL,
  config.mcpServers.supabase.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRecentLogs() {
  console.log('📋 Fetching Recent Edge Function Logs...\n');

  // 1. Get recent audit logs (function executions)
  console.log('1️⃣ Recent Audit Logs (Last 10):');
  const { data: auditLogs, error: auditError } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (auditError) {
    console.error('   Error:', auditError.message);
  } else {
    auditLogs?.forEach((log, i) => {
      const time = new Date(log.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] ${log.action} - ${log.resource_type || 'N/A'}`);
      if (log.details) {
        const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        if (details.function_name) console.log(`      Function: ${details.function_name}`);
        if (details.error) console.log(`      Error: ${details.error}`);
      }
    });
  }

  // 2. Get recent prompt runs (function executions)
  console.log('\n2️⃣ Recent Prompt Runs / Function Executions (Last 10):');
  const { data: promptRuns, error: promptError } = await supabase
    .from('prompt_runs')
    .select('id, created_at, status, ai_provider, ai_model, project_id, workflow_prompt_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (promptError) {
    console.error('   Error:', promptError.message);
  } else {
    promptRuns?.forEach((run, i) => {
      const time = new Date(run.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] Status: ${run.status} | Model: ${run.ai_model || 'N/A'}`);
      console.log(`      ID: ${run.id.substring(0, 8)}... | Project: ${run.project_id ? run.project_id.substring(0, 8) + '...' : 'N/A'}`);
    });
  }

  // 3. Get recent tool logs
  console.log('\n3️⃣ Recent Tool Execution Logs (Last 10):');
  const { data: toolLogs, error: toolError } = await supabase
    .from('tool_logs')
    .select('id, created_at, tool_name, status_code, duration_ms, prompt_run_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (toolError) {
    console.error('   Error:', toolError.message);
  } else {
    toolLogs?.forEach((log, i) => {
      const time = new Date(log.created_at).toLocaleString();
      const status = log.status_code === 200 ? '✅' : '❌';
      console.log(`   ${i + 1}. [${time}] ${status} ${log.tool_name} (${log.duration_ms}ms)`);
      if (log.status_code !== 200) console.log(`      Status Code: ${log.status_code}`);
    });
  }

  // 4. Summary statistics
  console.log('\n4️⃣ Summary Statistics:');
  const [auditCount, promptCount, toolCount] = await Promise.all([
    supabase.from('audit_log').select('id', { count: 'exact', head: true }),
    supabase.from('prompt_runs').select('id', { count: 'exact', head: true }),
    supabase.from('tool_logs').select('id', { count: 'exact', head: true })
  ]);

  console.log(`   Total Audit Logs: ${auditCount.count || 0}`);
  console.log(`   Total Prompt Runs: ${promptCount.count || 0}`);
  console.log(`   Total Tool Logs: ${toolCount.count || 0}`);

  // Get recent errors
  console.log('\n5️⃣ Recent Errors (Last 5):');
  const { data: errors, error: errorQueryError } = await supabase
    .from('audit_log')
    .select('*')
    .or('action.ilike.%error%,action.ilike.%fail%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (errorQueryError) {
    console.error('   Error:', errorQueryError.message);
  } else if (errors && errors.length > 0) {
    errors.forEach((err, i) => {
      const time = new Date(err.created_at).toLocaleString();
      console.log(`   ${i + 1}. [${time}] ${err.action}`);
      if (err.details) {
        const details = typeof err.details === 'string' ? JSON.parse(err.details) : err.details;
        if (details.error) console.log(`      ${details.error}`);
      }
    });
  } else {
    console.log('   ✅ No recent errors found');
  }
}

getRecentLogs().catch(console.error);

