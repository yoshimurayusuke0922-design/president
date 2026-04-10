param(
  [int]$LocalPort = 3001
)

$ErrorActionPreference = 'Stop'

$pidPath = Join-Path $PSScriptRoot 'public-tunnel.pid'
$logPath = Join-Path $PSScriptRoot 'public-tunnel.log'
$errPath = Join-Path $PSScriptRoot 'public-tunnel.err.log'
$knownHostsPath = Join-Path $PSScriptRoot 'localhost.run.known_hosts'

if (Test-Path $pidPath) {
  $existingPid = (Get-Content $pidPath -Raw).Trim()
  if ($existingPid) {
    $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existingProcess) {
      Stop-Process -Id $existingPid -Force
      Start-Sleep -Seconds 1
    }

    Remove-Item $pidPath -Force
  }
}

if (Test-Path $logPath) {
  Remove-Item $logPath -Force
}

if (Test-Path $errPath) {
  Remove-Item $errPath -Force
}

if (Test-Path $knownHostsPath) {
  Remove-Item $knownHostsPath -Force
}

$argumentList = @(
  '-o', 'StrictHostKeyChecking=no',
  '-o', "UserKnownHostsFile=$knownHostsPath",
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-o', 'ExitOnForwardFailure=yes',
  '-R', "80:127.0.0.1:$LocalPort",
  'nokey@localhost.run',
  '--', '--output', 'json'
)

$process = Start-Process `
  -FilePath 'ssh.exe' `
  -ArgumentList $argumentList `
  -WorkingDirectory $PSScriptRoot `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $errPath `
  -WindowStyle Hidden `
  -PassThru

$process.Id | Set-Content $pidPath

Start-Sleep -Seconds 6

Write-Output "tunnel-started:$($process.Id)"
if (Test-Path $logPath) {
  Get-Content $logPath -Tail 20
}
if (Test-Path $errPath) {
  Get-Content $errPath -Tail 20
}
