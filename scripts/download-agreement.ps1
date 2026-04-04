<#
.SYNOPSIS
  Login to local Nest API and download agreement PDF (PowerShell-friendly; no bash curl).

.EXAMPLE
  .\scripts\download-agreement.ps1 -Email "e2e-manager@orchidlife.in" -Password "YourPassword" -BookingId "uuid-here"

.EXAMPLE
  HTML fallback instead of PDF:
  .\scripts\download-agreement.ps1 ... -Format html -OutFile agreement.html
#>
param(
  [string] $BaseUrl = "http://127.0.0.1:3000",
  [Parameter(Mandatory = $true)][string] $Email,
  [Parameter(Mandatory = $true)][string] $Password,
  [Parameter(Mandatory = $true)][string] $BookingId,
  [ValidateSet("pdf", "html")]
  [string] $Format = "pdf",
  [string] $OutFile = ""
)

$ErrorActionPreference = "Stop"
if (-not $OutFile) {
  $OutFile = if ($Format -eq "html") { "agreement.html" } else { "agreement.pdf" }
}

$loginUri = "$BaseUrl/api/v1/auth/login"
$loginBody = (@{ email = $Email; password = $Password } | ConvertTo-Json -Compress)
$login = Invoke-RestMethod -Method Post -Uri $loginUri -ContentType "application/json; charset=utf-8" -Body $loginBody
if (-not $login.data.access_token) {
  throw "Login failed: no access_token in response"
}
$token = $login.data.access_token

$dlPath = "/api/v1/bookings/$BookingId/agreement-download"
if ($Format -eq "html") {
  $dlPath += "?format=html"
}
$dlUri = "$BaseUrl$dlPath"

Invoke-WebRequest -Uri $dlUri -Headers @{ Authorization = "Bearer $token" } -OutFile $OutFile
Write-Host "Saved: $OutFile"
