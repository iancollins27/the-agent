# Quick Start: Supabase MCP Setup

## Fast Setup (5 minutes)

### 1. Get Your Supabase Keys

Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api

Copy:
- **Project URL**: `https://YOUR_PROJECT_ID.supabase.co`
- **Service Role Key** (⚠️ Keep secret!)
- **Anon Key**

### 2. Configure in Cursor

1. Open Cursor Settings (`Ctrl+,` or `Cmd+,`)
2. Search for "MCP" 
3. Click "Edit MCP Settings" or add to your settings JSON:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "https://YOUR_PROJECT_ID.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_KEY_HERE",
        "SUPABASE_ANON_KEY": "YOUR_KEY_HERE"
      }
    }
  }
}
```

### 3. Restart Cursor

Close and reopen Cursor to load the MCP server.

### 4. Test It

Ask me: "Show me all tables in the Supabase database" or "Query the projects table"

## Using Environment Variables (More Secure)

1. Create `.env` file (add to `.gitignore`):
```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
SUPABASE_ANON_KEY=your_key_here
```

2. Update MCP config to use `${VARIABLE_NAME}` syntax

## Troubleshooting

- **Not working?** Check Cursor logs: `Help → Toggle Developer Tools → Console`
- **Can't find MCP settings?** Make sure you're on the latest Cursor version
- **Connection errors?** Verify your Supabase URL and keys are correct

See `MCP_SETUP.md` for detailed instructions.



