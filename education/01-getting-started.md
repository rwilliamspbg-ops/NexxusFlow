# 01: Getting Started with NexxusFlow

Welcome to NexxusFlow! This educational package is designed to teach you the fundamentals of high-performance systems, sovereign infrastructure, and production-grade security.

## Learning Objectives
- Understand the NexxusFlow monorepo structure.
- Bootstrap your local development environment.
- Run your first integrated lab: the JWT Auth Service.

## Architecture Overview
NexxusFlow is composed of three main layers:
1. **Data Plane (Rust)**: High-performance packet handling and core logic.
2. **Control & Narrative (Rust/Go)**: Orchestration and state management.
3. **Contracts & Schemas (TypeScript)**: Shared definitions and runtime validation.

## Prerequisites
Ensure you have the following installed:
- Rust (stable)
- Go (1.23+)
- Node.js (20+)
- Docker & Docker Compose

## 5-Minute Bootstrap
1. **Install Dependencies**:
   \`\`\`bash
   make bootstrap
   \`\`\`
2. **Configure Environment**:
   \`\`\`bash
   cp labs/path-1-sovereign-foundations/chapter-jwt-auth/.env.example labs/path-1-sovereign-foundations/chapter-jwt-auth/.env
   \`\`\`
3. **Launch the JWT Lab**:
   \`\`\`bash
   make education-demo
   \`\`\`

## Next Steps
Once you've verified your environment, proceed to [02-jwt-auth-fundamentals.md](./02-jwt-auth-fundamentals.md) to explore the security core.
