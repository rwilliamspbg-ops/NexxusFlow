# NexxusFlow Teaching Guide

This guide is intended for instructors and workshop leads using NexxusFlow as an educational tool.

## Curriculum Overview
NexxusFlow covers three primary domains:
1. **Security**: JWT implementation, token lifecycles, and defense-in-depth.
2. **Systems Engineering**: High-performance networking with Rust and AF_XDP.
3. **Operations**: Real-time observability, site reliability engineering (SRE), and CI/CD security.

## Workshop Modules
### Module 1: The Anatomy of a Secure Service
- **Goal**: Students identify common security pitfalls in JWT implementation.
- **Activity**: Use the \`/auth\` and \`/revoke\` endpoints. Ask students to implement a "force logout" feature for all users.
- **Discussion**: Why is HS256 used here instead of RS256? (Performance vs. Key Management).

### Module 2: Visualizing System Stress
- **Goal**: Understand the impact of latency on user experience.
- **Activity**: Use the Narrative Engine to inject 500ms of latency and observe the Grafana dashboards.
- **Discussion**: At what point does latency trigger an alert? (Check \`prometheus.rules.yml\`).

### Module 3: Extending the Engine
- **Goal**: Hands-on Rust experience.
- **Activity**: Follow the extension guide in \`crates/narrative-engine/src/lib.rs\` to add a "Packet Drop" simulation.

## Grading Rubric
- **Level 1**: Successfully bootstraps the environment and runs the walkthrough.
- **Level 2**: Identifies and explains the role of the rate limiter.
- **Level 3**: Successfully modifies the Rust data plane or Go control plane.

## Troubleshooting
- **Port Conflicts**: Ensure 8080 and 9090 are free.
- **Docker Issues**: Ensure Docker Desktop has at least 4GB of RAM allocated.
