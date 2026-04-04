<#
.SYNOPSIS
  End-to-end: login → first approved booking → agreement download (fixes common mistakes from manual PowerShell).

  Your terminal issues this avoids:
  - manager1@gmail.com / manager1234 only work if those users exist in YOUR Supabase (often they don't).
  - YOUR_PASSWORD is a placeholder — use a real password.
  - After failed login, $token is empty → "Missing or invalid Authorization header".
  - Bash curl with \ line breaks does not work in PowerShell — use this script or curl.exe on one line.
  - Default API response is PDF; use -Format html if PDF returns 503 (Puppeteer/Chrome).

.EXAMPLE
  # Match your working login (like e2e-manager + E2E_Manager_2026!):
  .\scripts\windows-agreement-download.ps1 -Email "e2e-manager@orchidlife.in" -Password "E2E_Manager_2026!"

.EXAMPLE
  Force HTML file (no Puppeteer):
  .\scripts\windows-agreement-download.ps1 -Email "..." -Password "..." -Format html
#>
param(
  [string] $BaseUrl = "http://127.0.0.1:3000",
  [Parameter(Mandatory = $true)][string] $Email,
  [Parameter(Mandatory = $true)][string] $Password,
  [ValidateSet("pdf", "html", "pdf-then-html")]
  [string] $Format = "pdf-then-html",
  [string] $OutFile = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Login {
  $body = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/auth/login" `
    -ContentType "application/json; charset=utf-8" -Body $body
  if (-not $r.data.access_token) {
    throw "Login failed: no access_token. Check email/password exist in Supabase Auth (not manager1@gmail.com unless you created that user)."
  }
  return [string] $r.data.access_token
}

function Get-FirstApprovedBookingId {
  param([string] $Token)
  $headers = @{ Authorization = "Bearer $Token" }
  $list = Invoke-RestMethod -Uri "$BaseUrl/api/v1/bookings?page=1&limit=50" -Headers $headers
  $rows = $list.data
  if (-not $rows) {
    throw "No bookings returned (empty list or wrong response shape)."
  }
  $approved = @($rows | Where-Object { $_.status -eq "approved" } | Select-Object -First 1)
  if ($approved.Count -lt 1) {
    throw "No approved booking in first 50 rows. Approve a booking in the app first."
  }
  return [string] $approved[0].id
}

function Assert-ValidPdfDownload {
  param([string] $Path)
  $fs = [System.IO.File]::OpenRead($Path)
  try {
    $buf = New-Object byte[] 4096
    $n = $fs.Read($buf, 0, $buf.Length)
    if ($n -lt 4) {
      throw "Downloaded file is too small to be a PDF."
    }
    $magic = [System.Text.Encoding]::ASCII.GetString($buf, 0, 4)
    if ($magic -eq '%PDF') {
      return
    }
    $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $n)
    if ($text -match 'AGREEMENT_PDF_FAILED|"success"\s*:\s*false') {
      throw "Saved file is a JSON error from the API, not a PDF. Install Chrome/Edge or set PUPPETEER_EXECUTABLE_PATH in .env, or use -Format html."
    }
    throw "File does not look like a PDF (expected %PDF header). The server may have returned an error body — use -Format html or fix PDF generation."
  } finally {
    $fs.Dispose()
  }
}

function Save-Agreement {
  param(
    [string] $Token,
    [string] $BookingId,
    [string] $Kind,
    [string] $Path
  )
  $suffix = if ($Kind -eq "html") { "?format=html" } else { "" }
  $uri = "$BaseUrl/api/v1/bookings/$BookingId/agreement-download$suffix"
  Invoke-WebRequest -Uri $uri -Headers @{ Authorization = "Bearer $Token" } -OutFile $Path
  if ($Kind -eq "pdf") {
    Assert-ValidPdfDownload -Path $Path
  }
}

$token = Invoke-Login
Write-Host "Login OK."
$bookingId = Get-FirstApprovedBookingId -Token $token
Write-Host "Using approved booking: $bookingId"

if (-not $OutFile) {
  $OutFile = if ($Format -eq "html") { "agreement.html" } elseif ($Format -eq "pdf") { "agreement.pdf" } else { "agreement.pdf" }
}

if ($Format -eq "html") {
  Save-Agreement -Token $token -BookingId $bookingId -Kind "html" -Path $OutFile
  Write-Host "Saved HTML: $OutFile"
  exit 0
}

if ($Format -eq "pdf") {
  try {
    Save-Agreement -Token $token -BookingId $bookingId -Kind "pdf" -Path $OutFile
    Write-Host "Saved PDF: $OutFile"
  }
  catch {
    Write-Warning "PDF failed: $_"
    throw
  }
  exit 0
}

# pdf-then-html: try PDF, on 503 save HTML
try {
  Save-Agreement -Token $token -BookingId $bookingId -Kind "pdf" -Path "agreement.pdf"
  Write-Host "Saved PDF: agreement.pdf"
}
catch {
  $err = $_.Exception.Message
  if ($err -notmatch "503|AGREEMENT_PDF_FAILED|Service Unavailable") {
    throw
  }
  Write-Warning "PDF not available (Puppeteer/Chrome). Saving HTML instead → agreement.html"
  Write-Host "Tip: install Chrome/Edge or set PUPPETEER_EXECUTABLE_PATH in .env"
  Save-Agreement -Token $token -BookingId $bookingId -Kind "html" -Path "agreement.html"
  Write-Host "Saved HTML: agreement.html"
}
