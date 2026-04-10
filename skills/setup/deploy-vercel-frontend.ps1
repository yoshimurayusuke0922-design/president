param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl
)

$ErrorActionPreference = 'Stop'

$normalizedBackendUrl = $BackendUrl.TrimEnd('/')

npx --yes vercel --cwd frontend --prod --yes --build-env "VITE_SERVER_URL=$normalizedBackendUrl"
