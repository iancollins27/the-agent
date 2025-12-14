// Quick test script to verify Supabase MCP server can connect
// Run with: node test-mcp-connection.js

const SUPABASE_URL = "https://lvifsxsrbluehopamqpy.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aWZzeHNyYmx1ZWhvcGFtcXB5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTgzMDQ2MiwiZXhwIjoyMDU1NDA2NDYyfQ.Q19b7GTy1CwZL1SLyl4eZz7iNYPsWw3PRqcDtZk9imI";

async function testConnection() {
  try {
    // Try to install/run the MCP server package
    console.log("Testing Supabase MCP server connection...");
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Service Role Key starts with:", SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + "...");
    
    // Test if we can import the package
    const { execSync } = require('child_process');
    
    console.log("\n1. Testing if @supabase/mcp-server can be installed...");
    try {
      execSync('npx -y @supabase/mcp-server --version', { stdio: 'inherit' });
      console.log("✓ Package is accessible");
    } catch (error) {
      console.log("✗ Package installation test failed");
      console.log("Error:", error.message);
    }
    
    console.log("\n2. Testing direct Supabase connection...");
    const { createClient } = require('@supabase/supabase-js');
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


