# Where to Add MCP Configuration in Cursor

## Method 1: User Profile Configuration File (Recommended)

Cursor stores MCP configuration in your **user profile directory**, not in the project folder.

### Step 1: Find Your Cursor Config Directory

**On Windows:**
```
C:\Users\YourUsername\.cursor\mcp.json
```

**On macOS:**
```
~/.cursor/mcp.json
```

**On Linux:**
```
~/.cursor/mcp.json
```

### Step 2: Create or Edit the File

1. Navigate to that directory (create `.cursor` folder if it doesn't exist)
2. Create or open `mcp.json` file
3. Copy the configuration from `.cursor/mcp-config.json` in this project
4. **Replace the environment variable placeholders** with your actual keys:

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
        "SUPABASE_URL": "https://lvifsxsrbluehopamqpy.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "YOUR_ACTUAL_SERVICE_ROLE_KEY_HERE",
        "SUPABASE_ANON_KEY": "YOUR_ACTUAL_ANON_KEY_HERE"
      }
    }
  }
}
```

### Step 3: Get Your Keys

1. Go to: https://supabase.com/dashboard/project/lvifsxsrbluehopamqpy/settings/api
2. Copy:
   - **`service_role` key** (the secret one - starts with `eyJ...`)
   - **`anon` key** (the public one)

### Step 4: Paste Your Keys

Replace:
- `YOUR_ACTUAL_SERVICE_ROLE_KEY_HERE` with your service_role key
- `YOUR_ACTUAL_ANON_KEY_HERE` with your anon key

### Step 5: Save and Restart Cursor

1. Save the `mcp.json` file
2. **Completely close and restart Cursor** (not just reload window)

## Method 2: Using Cursor Settings UI

Some Cursor versions have a UI for this:

1. Open Cursor Settings:
   - **Windows/Linux**: `Ctrl + ,`
   - **Mac**: `Cmd + ,`

2. Search for: `mcp` or `model context protocol`

3. If you see "MCP Servers" or "Model Context Protocol" section:
   - Click "Add Server" or "Edit Configuration"
   - Paste the configuration there

4. If you don't see MCP settings in the UI, use **Method 1** (the file-based approach)

## Method 3: Quick Copy-Paste Script

**On Windows (PowerShell):**
```powershell
# Create the directory if it doesn't exist
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.cursor"

# Copy the config template
Copy-Item ".cursor\mcp-config.json" "$env:USERPROFILE\.cursor\mcp.json"

# Open it for editing
notepad "$env:USERPROFILE\.cursor\mcp.json"
```

**On macOS/Linux:**
```bash
# Create the directory if it doesn't exist
mkdir -p ~/.cursor

# Copy the config template
cp .cursor/mcp-config.json ~/.cursor/mcp.json

# Open it for editing
nano ~/.cursor/mcp.json
# or
code ~/.cursor/mcp.json
```

Then edit the file to add your actual keys.

## Verification

After restarting Cursor, you can verify it's working by:

1. Opening the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Searching for "MCP" - you should see MCP-related commands
3. Or just ask me: "Can you query the Supabase database?" and I'll try to use the MCP server

## Troubleshooting

**Can't find the `.cursor` folder?**
- It's hidden by default on Windows/Mac
- On Windows: Enable "Show hidden files" in File Explorer
- On Mac: Press `Cmd+Shift+.` in Finder to show hidden files
- Or use the terminal/command line to navigate there

**File doesn't exist?**
- That's fine! Just create it with the configuration above

**Still not working?**
- Make sure you saved the file
- Make sure you **completely restarted Cursor** (quit and reopen)
- Check Cursor's developer console for errors: `Help → Toggle Developer Tools`



