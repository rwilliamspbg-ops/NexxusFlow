# 1. Setup
.\scripts\setup-env.ps1

# 2. Launch Docker
Write-Host "Launching NexxusFlow Educational Stack..." -ForegroundColor Cyan
docker compose -f labs/path-1-sovereign-foundations/chapter-jwt-auth/docker-compose.yml up --build -d

# 3. Wait for health
Write-Host "Waiting for backend to be healthy..."
while (-not (Invoke-WebRequest -Uri "http://localhost:8080/health" -ErrorAction SilentlyContinue)) {
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 1
}
Write-Host " Healthy!" -ForegroundColor Green

# 4. Run Walkthrough
# We'll run the bash script via sh if available, otherwise just print next steps
Write-Host "`nReady! You can access the lab at http://localhost:8080"
Write-Host "To run the interactive walkthrough, use a bash terminal: ./scripts/interactive-walkthrough.sh"
