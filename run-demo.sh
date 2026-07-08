#!/bin/bash
set -e

# 1. Setup
./scripts/setup-env.sh

# 2. Launch Docker
echo "Launching NexxusFlow Educational Stack..."
docker compose -f labs/path-1-sovereign-foundations/chapter-jwt-auth/docker-compose.yml up --build -d

# 3. Wait for health
echo "Waiting for backend to be healthy..."
until $(curl --output /dev/null --silent --head --fail http://localhost:8080/health); do
    printf '.'
    sleep 1
done
echo " Healthy!"

# 4. Run Walkthrough
./scripts/interactive-walkthrough.sh
