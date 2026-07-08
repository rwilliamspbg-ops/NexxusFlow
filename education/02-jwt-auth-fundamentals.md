# 02: JWT Authentication Fundamentals

This module explores the implementation of a production-ready JWT authentication service.

## What is a JWT?
JSON Web Tokens (JWT) are a compact, URL-safe means of representing claims to be transferred between two parties. In NexxusFlow, we use HS256 (HMAC with SHA-256) for signing.

## Key Security Features in NexxusFlow
- **Rate Limiting**: Protection against brute-force and DoS attacks using a Token Bucket algorithm.
- **Token Revocation**: An in-memory blacklist to simulate immediate token invalidation.
- **Secret Rotation**: The ability to rotate the signing key without service downtime.
- **Input Validation**: Rigorous checking of all user-supplied data to prevent injection attacks.

## Interactive Lab
1. **Issue a Token**:
   \`\`\`bash
   curl -X POST http://localhost:8080/auth \\
     -H "Content-Type: application/json" \\
     -d '{"user_id":"student_01", "role":"admin"}'
   \`\`\`
2. **Revoke a Token**:
   Use the token received above in the Authorization header.
   \`\`\`bash
   curl -X POST http://localhost:8080/revoke \\
     -H "Authorization: Bearer <YOUR_TOKEN>"
   \`\`\`

## Deep Dive
Explore the source code in \`labs/path-1-sovereign-foundations/chapter-jwt-auth/main.go\` to see how these features are implemented in Go.
