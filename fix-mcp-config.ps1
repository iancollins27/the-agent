# Fix MCP Configuration - Remove $ prefix from keys
$configPath = "$env:USERPROFILE\.cursor\mcp.json"

Write-Host "Fixing MCP configuration..." -ForegroundColor Yellow

# Read the file
$content = Get-Content $configPath -Raw

# Remove $ prefix from keys (they should start with eyJ, not $eyJ)
$content = $content -replace '\$eyJ', 'eyJ'

# Write back
Set-Content $configPath -Value $content -NoNewline

Write-Host "Fixed! Removed dollar sign prefix from keys" -ForegroundColor Green
Write-Host ""
Write-Host "Please restart Cursor for changes to take effect." -ForegroundColor Cyan
