# PowerShell script to spin down local development Docker infrastructure
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$RootEnv = Join-Path $ProjectRoot ".env"

Write-Host "Stopping Docker Compose services..." -ForegroundColor Red
docker compose -f (Join-Path $ProjectRoot "docker/docker-compose.yml") --env-file $RootEnv down
