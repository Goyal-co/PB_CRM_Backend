<#
.SYNOPSIS
  Download agreement PDF using real curl.exe (not PowerShell's Invoke-WebRequest alias).

.EXAMPLE
  .\scripts\curl-agreement-pdf.ps1 -Token $token -BookingId "00000000-0000-0000-0000-000000000000"

  One line (replace TOKEN and UUID):
  curl.exe -s -H "Authorization: Bearer TOKEN" "http://127.0.0.1:3000/api/v1/bookings/UUID/agreement-download" -o agreement.pdf
#>
param(
  [Parameter(Mandatory = $true)][string] $Token,
  [Parameter(Mandatory = $true)][string] $BookingId,
  [string] $BaseUrl = "http://127.0.0.1:3000",
  [string] $OutFile = "agreement.pdf"
)

$uri = "$BaseUrl/api/v1/bookings/$BookingId/agreement-download"
& curl.exe -s -H "Authorization: Bearer $Token" $uri -o $OutFile
if ($LASTEXITCODE -ne 0) {
  throw "curl.exe failed with exit code $LASTEXITCODE"
}
Write-Host "Saved: $OutFile"
