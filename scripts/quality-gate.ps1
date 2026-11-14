$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$backendProject = Join-Path $frontendRoot '..\AutoID\src\AutoID\AutoID.csproj'
$backendChecks = Join-Path $frontendRoot '..\AutoID\tests\NotificationAccessChecks\NotificationAccessChecks.csproj'

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  Write-Host "`n== $Label =="
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

Push-Location $frontendRoot
try {
  if (Test-Path "C:\Program Files\nodejs") {
    $env:PATH = "C:\Program Files\nodejs;$env:PATH"
  }
  Invoke-Checked 'Frontend typecheck' { cmd.exe /c npm run typecheck }
  Invoke-Checked 'Frontend component and contract tests' { cmd.exe /c npm test }
  Invoke-Checked 'Frontend production build' { cmd.exe /c npm run build }
  Invoke-Checked 'Frontend bundle budget' { cmd.exe /c npm run bundle:check }
  Invoke-Checked 'Backend release build' { dotnet build $backendProject -c Release }
  Invoke-Checked 'Line leader workflow and migration checks' { dotnet run --project (Join-Path $frontendRoot '..\AutoID\tests\LineLeaderWorkflowChecks\LineLeaderWorkflowChecks.csproj') -c Release }
  Invoke-Checked 'Backend isolated SQLite suite' { dotnet run --project $backendChecks -c Release }
  Write-Host "`nAll quality gates passed. Production data was not used."
}
finally {
  Pop-Location
}
