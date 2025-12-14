// Quick test script to verify Supabase MCP server can connect
// Run with: node test-mcp-connection.js

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read MCP config to get credentials (same approach as other test scripts)
const userProfile = process.env.USERPROFILE || process.env.HOME;
const mcpConfigPath = path.join(userProfile, '.cursor', 'mcp.json');
let mcpConfig;

try {
  mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
} catch (error) {
  console.error('Could not read MCP config:', error.message);
  console.error('Please ensure MCP is configured at:', mcpConfigPath);
  process.exit(1);
}

const SUPABASE_URL = mcpConfig.mcpServers?.supabase?.env?.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = mcpConfig.mcpServers?.supabase?.env?.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in MCP config');
  console.error('Please configure MCP at:', mcpConfigPath);
  process.exit(1);
}

async function testConnection() {
  try {
    // Try to install/run the MCP server package
    console.log("Testing Supabase MCP server connection...");
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Service Role Key starts with:", SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + "...");
    
    // Test if we can import the package
    const childProcess = await import('child_process');
    
    console.log("\n1. Testing if @supabase/mcp-server can be installed...");
    try {
      childProcess.execSync('npx -y @supabase/mcp-server --version', { stdio: 'inherit' });
      console.log("✓ Package is accessible");
    } catch (error) {
      console.log("✗ Package installation test failed");
      console.log("Error:", error.message);
    }
    
    console.log("\n2. Testing direct Supabase connection...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Try a simple query
    const { data, error } = await supabase.from('projects').select('id').limit(1);
    
    if (error) {
      console.log("✗ Database connection failed:", error.message);
      return false;
    }
    
    console.log("✓ Database connection successful!");
    console.log("✓ Found", data?.length || 0, "project(s)");
    return true;
    
  } catch (error) {
    console.error("✗ Test failed:", error.message);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});


