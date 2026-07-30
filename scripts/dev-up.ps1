# PowerShell script to spin up the local development Docker infrastructure
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Copy .env file if it does not exist
$RootEnv = Join-Path $ProjectRoot ".env"
$RootEnvExample = Join-Path $ProjectRoot ".env.example"

if (-not (Test-Path $RootEnv)) {
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item $RootEnvExample $RootEnv
}

Write-Host "Starting Docker Compose services (MySQL, n8n)..." -ForegroundColor Green
docker compose -f (Join-Path $ProjectRoot "docker/docker-compose.yml") --env-file $RootEnv up -d

Write-Host "Waiting for services to become healthy..." -ForegroundColor Cyan
docker compose -f (Join-Path $ProjectRoot "docker/docker-compose.yml") ps
