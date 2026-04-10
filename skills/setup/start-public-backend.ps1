param(
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pidPath = Join-Path $PSScriptRoot 'public-backend.pid'
$logPath = Join-Path $PSScriptRoot 'public-backend.log'
$errPath = Join-Path $PSScriptRoot 'public-backend.err.log'

if (Test-Path $pidPath) {
  $existingPid = (Get-Content $pidPath -Raw).Trim()
  if ($existingPid) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Write-Output "backend-already-running:$existingPid"
      Write-Output "log:$logPath"
      exit 0
    }
  }
}

$frontendDist = Join-Path $repoRoot 'frontend\dist'
if (-not (Test-Path $frontendDist)) {
  throw 'frontend/dist is missing. Build frontend first.'
}

$command = @(
  ('$env:PORT=''' + $Port + '''')
  ('Set-Location ''' + $repoRoot + '''')
  'npm.cmd exec --workspace backend tsx src/server.ts'
) -join '; '

$process = Start-Process `
  -FilePath 'powershell.exe' `
  -ArgumentList '-NoProfile', '-Command', $command `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $errPath `
  -WindowStyle Hidden `
  -PassThru

$process.Id | Set-Content $pidPath

Write-Output "backend-started:$($process.Id)"
Write-Output "port:$Port"
Write-Output "log:$logPath"
