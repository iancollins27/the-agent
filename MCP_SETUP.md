# MCP Server Setup for Supabase

This guide will help you set up a Model Context Protocol (MCP) server to connect Cursor with your Supabase database, enabling direct database read and write operations.

## Prerequisites

- Node.js installed (for running the MCP server)
- Supabase project credentials
- Cursor IDE

## Option 1: Using Supabase's Official MCP Server (Recommended)

### Step 1: Get Your Supabase Credentials

You'll need:
- **Supabase URL**: `https://YOUR_PROJECT_ID.supabase.co`
- **Service Role Key**: Get this from your Supabase dashboard → Settings → API
- **Anon Key**: Also from Settings → API

⚠️ **Important**: The Service Role Key has full database access. Keep it secure!

### Step 2: Configure Cursor MCP Settings

1. Open Cursor Settings:
   - **Windows/Linux**: `Ctrl + ,` or `File → Preferences → Settings`
   - **Mac**: `Cmd + ,`

2. Search for "MCP" or "Model Context Protocol"

3. Add the Supabase MCP server configuration:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server"
      ],
      "env": {
        "SUPABASE_URL": "https://YOUR_PROJECT_ID.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_SERVICE_ROLE_KEY_HERE",
        "SUPABASE_ANON_KEY": "YOUR_ANON_KEY_HERE"
      }
    }
  }
}
```

### Step 3: Alternative - Use Environment Variables

For better security, you can use environment variables instead of hardcoding keys:

1. Create a `.env` file in your project root (add to `.gitignore`):
```env
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
```

2. Update the MCP config to reference environment variables:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_SERVICE_ROLE_KEY": "${SUPABASE_SERVICE_ROLE_KEY}",
        "SUPABASE_ANON_KEY": "${SUPABASE_ANON_KEY}"
      }
    }
  }
}
```

## Option 2: Self-Hosted MCP Server (For Local Development)

If you're running Supabase locally, you can create a custom MCP server.

### Step 1: Install Dependencies

```bash
npm install @modelcontextprotocol/sdk @supabase/supabase-js
```

### Step 2: Create MCP Server Script

Create `mcp-server.js`:

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const server = new Server({
  name: 'supabase-mcp-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

// Add tools for database operations
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'query_database',
      description: 'Execute a SQL query on the Supabase database',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'SQL query to execute',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'insert_record',
      description: 'Insert a record into a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          data: { type: 'object' },
        },
        required: ['table', 'data'],
      },
    },
    {
      name: 'update_record',
      description: 'Update a record in a table',
      inputSchema: {
        type: 'object',
        properties: {
          table: { type: 'string' },
          id: { type: 'string' },
          data: { type: 'object' },
        },
        required: ['table', 'id', 'data'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'query_database':
      const { data, error } = await supabase.rpc('exec_sql', { query: args.query });
      return {
        content: [
          {
            type: 'text',
            text: error ? JSON.stringify(error) : JSON.stringify(data, null, 2),
          },
        ],
      };

    case 'insert_record':
      const { data: insertData, error: insertError } = await supabase
        .from(args.table)
        .insert(args.data)
        .select();
      return {
        content: [
          {
            type: 'text',
            text: insertError ? JSON.stringify(insertError) : JSON.stringify(insertData, null, 2),
          },
        ],
      };

    case 'update_record':
      const { data: updateData, error: updateError } = await supabase
        .from(args.table)
        .update(args.data)
        .eq('id', args.id)
        .select();
      return {
        content: [
          {
            type: 'text',
            text: updateError ? JSON.stringify(updateError) : JSON.stringify(updateData, null, 2),
          },
        ],
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Supabase MCP server running on stdio');
}

main().catch(console.error);
```

### Step 3: Configure Cursor

```json
{
  "mcpServers": {
    "supabase-local": {
      "command": "node",
      "args": ["mcp-server.js"],
      "env": {
        "SUPABASE_URL": "http://localhost:54321",
        "SUPABASE_SERVICE_ROLE_KEY": "your_local_service_key"
      }
    }
  }
}
```

## Option 3: Using Supabase Cloud MCP (Easiest)

If you're using Supabase Cloud, you can use their hosted MCP server:

1. Go to [Supabase MCP Setup](https://supabase.com/mcp)
2. Follow the authentication flow
3. Cursor will automatically configure the connection

## Verifying the Setup

After configuration:

1. Restart Cursor
2. Open the MCP panel (if available) or check Cursor's status
3. Try asking: "Show me all tables in the database" or "Query the projects table"

## Security Considerations

1. **Service Role Key**: Has full database access. Never commit it to version control.
2. **Read-Only Mode**: Consider creating a read-only database user for MCP access
3. **RLS Policies**: Your Row Level Security policies will still apply
4. **Environment Variables**: Always use environment variables for sensitive keys

## Troubleshooting

### MCP Server Not Connecting

1. Check that Node.js is installed: `node --version`
2. Verify your Supabase URL and keys are correct
3. Check Cursor's logs for MCP errors
4. Ensure the `@supabase/mcp-server` package can be installed

### Permission Errors

- Verify your Service Role Key has the correct permissions
- Check that your Supabase project is active
- Ensure RLS policies allow the operations you're trying to perform

### Connection Timeout

- Check your internet connection
- Verify the Supabase URL is accessible
- For local Supabase, ensure it's running on the correct port

## Next Steps

Once set up, you can:
- Query your database directly through natural language
- Create and update records
- Analyze data patterns
- Generate reports

Example queries you can try:
- "Show me all projects created in the last week"
- "Count how many contacts are in the database"
- "Update project status for project ID xyz"
- "Create a new contact with name John Doe"

## Additional Resources

- [Supabase MCP Documentation](https://supabase.com/docs/guides/mcp)
- [Model Context Protocol Spec](https://modelcontextprotocol.io)
- [Cursor MCP Documentation](https://docs.cursor.com)



