# Security Policy

## Supported Versions

Currently, only the latest version on the `main` branch is supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of NexxusFlow seriously. If you find a security vulnerability, please do **not** open a public issue. Instead, please report it via one of the following methods:

- Email: security@nexxusflow.dev (placeholder)
- Open a draft security advisory on GitHub

Please include:
- A description of the vulnerability.
- Steps to reproduce.
- Potential impact.

We will acknowledge your report within 48 hours and provide a timeline for resolution.

## Security Controls

- **Image Signing**: All backend images on `main` are signed using Sigstore Cosign.
- **Contract Verification**: Strict Zod-based validation is enforced between services.
- **Rate Limiting**: Public-facing lab endpoints include token bucket rate limiting.
