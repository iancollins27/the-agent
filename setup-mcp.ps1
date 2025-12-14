# MCP Configuration Setup Script for Windows
# This script helps you set up the Supabase MCP server configuration

Write-Host "Setting up MCP configuration for Cursor..." -ForegroundColor Green

# Your Cursor config directory
$cursorConfigDir = "$env:USERPROFILE\.cursor"
$mcpConfigFile = "$cursorConfigDir\mcp.json"

# Create .cursor directory if it doesn't exist
if (-not (Test-Path $cursorConfigDir)) {
    Write-Host "Creating .cursor directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $cursorConfigDir -Force | Out-Null
}

# Check if mcp.json already exists
if (Test-Path $mcpConfigFile) {
    Write-Host "`nWARNING: mcp.json already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/n)"
    if ($overwrite -ne "y") {
        Write-Host "Cancelled. Your existing configuration is safe." -ForegroundColor Yellow
        exit
    }
}

# Get Supabase credentials from user
Write-Host "`n=== Supabase Configuration ===" -ForegroundColor Cyan
Write-Host "You'll need to get these from: https://supabase.com/dashboard/project/lvifsxsrbluehopamqpy/settings/api`n" -ForegroundColor Yellow

$supabaseUrl = "https://lvifsxsrbluehopamqpy.supabase.co"
Write-Host "Supabase URL: $supabaseUrl" -ForegroundColor Green

$serviceRoleKey = Read-Host "Enter your Service Role Key (starts with 'eyJ...')"
$anonKey = Read-Host "Enter your Anon Key (starts with 'eyJ...')"

# Create the configuration
$config = @{
    mcpServers = @{
        supabase = @{
            command = "npx"
            args = @("-y", "@supabase/mcp-server")
            env = @{
                SUPABASE_URL = $supabaseUrl
                SUPABASE_SERVICE_ROLE_KEY = $serviceRoleKey
                SUPABASE_ANON_KEY = $anonKey
            }
        }
    }
} | ConvertTo-Json -Depth 10

# Write to file
$config | Out-File -FilePath $mcpConfigFile -Encoding utf8

Write-Host "`n✓ Configuration saved to: $mcpConfigFile" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Restart Cursor completely (close and reopen)" -ForegroundColor White
Write-Host "2. Test by asking the AI to query your database" -ForegroundColor White
Write-Host "`nConfiguration file location: $mcpConfigFile" -ForegroundColor Gray



