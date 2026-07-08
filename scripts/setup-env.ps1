Write-Host "Setting up NexxusFlow Development Environment..." -ForegroundColor Blue

# Install TS dependencies
Write-Host "Installing TypeScript dependencies..."
npm ci --prefix packages/types-shared

# Setup .env
Write-Host "Creating default .env file..."
$envFile = "labs/path-1-sovereign-foundations/chapter-jwt-auth/.env"
$exampleFile = "labs/path-1-sovereign-foundations/chapter-jwt-auth/.env.example"

if (-not (Test-Path $envFile)) {
    Copy-Item $exampleFile $envFile
    Write-Host ".env created in labs/path-1-sovereign-foundations/chapter-jwt-auth/"
} else {
    Write-Host ".env already exists."
}

Write-Host "Setup Complete! You can now run './run-demo.ps1'." -ForegroundColor Green
