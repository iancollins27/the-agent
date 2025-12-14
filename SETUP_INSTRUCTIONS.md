# Exact Steps: Where to Add MCP Configuration

## The Answer: It Goes in Your User Profile, Not the Project

The MCP configuration file needs to be in:
```
C:\Users\Windows\.cursor\mcp.json
```

**NOT** in your project folder!

## Step-by-Step Instructions

### Option A: Use the Setup Script (Easiest)

1. **Run the PowerShell script:**
   ```powershell
   .\setup-mcp.ps1
   ```

2. **Follow the prompts** - it will ask for your Supabase keys

3. **Restart Cursor**

### Option B: Manual Setup

#### Step 1: Navigate to Your Cursor Config Folder

**On Windows:**
1. Open File Explorer
2. In the address bar, type: `%USERPROFILE%\.cursor`
3. Press Enter
4. If the folder doesn't exist, create it

**Or use PowerShell:**
```powershell
cd $env:USERPROFILE\.cursor
```

#### Step 2: Create or Edit `mcp.json`

1. If `mcp.json` doesn't exist, create a new file named `mcp.json`
2. Open it in any text editor (Notepad, VS Code, etc.)

#### Step 3: Copy This Configuration

Paste this into the file:

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
        "SUPABASE_SERVICE_ROLE_KEY": "PASTE_YOUR_SERVICE_ROLE_KEY_HERE",
        "SUPABASE_ANON_KEY": "PASTE_YOUR_ANON_KEY_HERE"
      }
    }
  }
}
```

#### Step 4: Get Your Supabase Keys

1. Go to: https://supabase.com/dashboard/project/lvifsxsrbluehopamqpy/settings/api
2. Find these two keys:
   - **`service_role` key** (the secret one - very long, starts with `eyJ...`)
   - **`anon` `public` key** (also long, starts with `eyJ...`)

#### Step 5: Replace the Placeholders

In your `mcp.json` file:
- Replace `PASTE_YOUR_SERVICE_ROLE_KEY_HERE` with your actual service_role key
- Replace `PASTE_YOUR_ANON_KEY_HERE` with your actual anon key

#### Step 6: Save and Restart

1. Save the file
2. **Completely close Cursor** (File → Exit, don't just close the window)
3. **Reopen Cursor**
4. Open this project

## Visual Guide

```
Your Computer
└── C:\Users\Windows\          ← Your user profile
    └── .cursor\               ← Cursor's config folder (may be hidden)
        └── mcp.json           ← THIS is where the config goes
```

**NOT here:**
```
C:\Users\Windows\.cursor\the-agent\  ← Your project folder
└── .cursor\                        ← This is different!
    └── mcp-config.json             ← This is just a template
```

## Quick Test

After setup, ask me:
- "Can you query the Supabase database?"
- "Show me all tables in the database"
- "What's in the projects table?"

If I can access it, the setup worked!

## Troubleshooting

**"I can't find the .cursor folder"**
- It's hidden by default
- In File Explorer: View → Show → Hidden items
- Or use PowerShell: `cd $env:USERPROFILE\.cursor`

**"The file doesn't exist"**
- That's fine! Just create it with the configuration above

**"Still not working after restart"**
- Make sure you saved the file
- Check for JSON syntax errors (use a JSON validator)
- Make sure your keys are correct (no extra spaces)
- Check Cursor's developer console: Help → Toggle Developer Tools



