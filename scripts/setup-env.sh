#!/bin/bash
set -e

echo "Setting up NexxusFlow Development Environment..."

# Install TS dependencies
echo "Installing TypeScript dependencies..."
npm ci --prefix packages/types-shared

# Setup .env
echo "Creating default .env file..."
if [ ! -f labs/path-1-sovereign-foundations/chapter-jwt-auth/.env ]; then
    cp labs/path-1-sovereign-foundations/chapter-jwt-auth/.env.example labs/path-1-sovereign-foundations/chapter-jwt-auth/.env
    echo ".env created in labs/path-1-sovereign-foundations/chapter-jwt-auth/"
else
    echo ".env already exists."
fi

echo "Setup Complete! You can now run 'make education-demo' or './run-demo.sh'."
