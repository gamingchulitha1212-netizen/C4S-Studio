# C4S Studio - sets the Vercel environment variables for you (email notifications + invoices).
# Run in PowerShell:   powershell -ExecutionPolicy Bypass -File .\setup-vercel.ps1
# Nothing is saved to disk. The app password is typed here and sent straight to Vercel over HTTPS.

$ErrorActionPreference = 'Stop'

function Read-Secret($prompt) {
  $s = Read-Host -Prompt $prompt -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Write-Host ""
Write-Host "Create a Vercel token first: https://vercel.com/account/tokens  (Create Token, any name, expiry 1 day is fine)" -ForegroundColor Cyan
$token   = Read-Secret "Vercel token"
$project = Read-Host "Vercel project name (as shown in the Vercel dashboard)"
$team    = Read-Host "Team ID (press Enter if the project is under your personal account)"
$gmail   = Read-Host "Gmail address that sends the emails [chulitharv123@gmail.com]"
if (-not $gmail) { $gmail = 'chulitharv123@gmail.com' }
$appPass = (Read-Secret "Gmail APP password (16 letters, spaces are removed)") -replace '\s', ''
if ($appPass.Length -ne 16) { throw "The app password must be 16 letters. Create it at Google Account > Security > App passwords." }
$saPath  = Read-Host "Path to the Firebase service-account JSON file (press Enter to skip if already set)"

$vars = @(
  @{ key = 'GMAIL_USER';         value = $gmail },
  @{ key = 'GMAIL_APP_PASSWORD'; value = $appPass }
)
if ($saPath) {
  if (-not (Test-Path $saPath)) { throw "File not found: $saPath" }
  $json = (Get-Content -Raw -Path $saPath | ConvertFrom-Json | ConvertTo-Json -Compress -Depth 10)
  $vars += @{ key = 'FIREBASE_SERVICE_ACCOUNT'; value = $json }
}

$uri = "https://api.vercel.com/v10/projects/$([uri]::EscapeDataString($project))/env?upsert=true"
if ($team) { $uri += "&teamId=$([uri]::EscapeDataString($team))" }
$headers = @{ Authorization = "Bearer $token" }

foreach ($v in $vars) {
  $body = @{ key = $v.key; value = $v.value; type = 'encrypted'; target = @('production', 'preview', 'development') } | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
    Write-Host "OK  $($v.key)" -ForegroundColor Green
  } catch {
    Write-Host "FAILED  $($v.key): $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  }
}

$appPass = $null; $token = $null
Write-Host ""
Write-Host "Last step: Vercel dashboard > your project > Deployments > latest > ... > Redeploy" -ForegroundColor Cyan
Write-Host "(New variables only work after a redeploy.)"
