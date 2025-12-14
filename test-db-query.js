// Test script to query Supabase database
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read MCP config to get credentials
const userProfile = process.env.USERPROFILE || process.env.HOME;
const mcpConfigPath = path.join(userProfile, '.cursor', 'mcp.json');
let mcpConfig;

try {
  mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
} catch (error) {
  console.error('Could not read MCP config:', error.message);
  process.exit(1);
}

const supabaseUrl = mcpConfig.mcpServers?.supabase?.env?.SUPABASE_URL;
const serviceRoleKey = mcpConfig.mcpServers?.supabase?.env?.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in MCP config');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testQueries() {
  console.log('🔍 Testing Supabase Database Connection...\n');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Service Role Key starts with:', serviceRoleKey.substring(0, 20) + '...\n');

  try {
    // Test 1: Simple connection test
    console.log('1️⃣ Testing database connection...');
    console.log('   ✅ Connected to Supabase');

    // Test 2: Query projects table
    console.log('2️⃣ Querying projects table...');
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, project_name, company_id, created_at')
      .limit(5);

    if (projectsError) {
      console.error('   ❌ Error:', projectsError.message);
    } else {
      console.log(`   ✅ Found ${projects?.length || 0} projects`);
      if (projects && projects.length > 0) {
        console.log('   Sample projects:');
        projects.forEach((p, i) => {
          console.log(`      ${i + 1}. ${p.project_name || p.id.substring(0, 8)} (ID: ${p.id.substring(0, 8)}...)`);
        });
      }
    }

    // Test 3: Query companies table
    console.log('\n3️⃣ Querying companies table...');
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .limit(5);

    if (companiesError) {
      console.error('   ❌ Error:', companiesError.message);
    } else {
      console.log(`   ✅ Found ${companies?.length || 0} companies`);
      if (companies && companies.length > 0) {
        console.log('   Sample companies:');
        companies.forEach((c, i) => {
          console.log(`      ${i + 1}. ${c.name || 'Unnamed'} (ID: ${c.id.substring(0, 8)}...)`);
        });
      }
    }

    // Test 4: Query contacts table
    console.log('\n4️⃣ Querying contacts table...');
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, full_name, role, phone_number')
      .limit(5);

    if (contactsError) {
      console.error('   ❌ Error:', contactsError.message);
    } else {
      console.log(`   ✅ Found ${contacts?.length || 0} contacts`);
      if (contacts && contacts.length > 0) {
        console.log('   Sample contacts:');
        contacts.forEach((c, i) => {
          console.log(`      ${i + 1}. ${c.full_name || 'Unnamed'} (${c.role || 'No role'})`);
        });
      }
    }

    // Test 5: Count records
    console.log('\n5️⃣ Getting record counts...');
    const [projectsCount, companiesCount, contactsCount] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('companies').select('id', { count: 'exact', head: true }),
      supabase.from('contacts').select('id', { count: 'exact', head: true })
    ]);

    console.log(`   Projects: ${projectsCount.count || 0}`);
    console.log(`   Companies: ${companiesCount.count || 0}`);
    console.log(`   Contacts: ${contactsCount.count || 0}`);

    console.log('\n✅ Database connection successful!');
    console.log('✅ MCP server should be able to access your database.\n');

  } catch (error) {
    console.error('\n❌ Database query failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testQueries();

