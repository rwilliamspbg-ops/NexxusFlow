# NexxusFlow Pull Requests Audit & Status Report

**Repository:** `rwilliamspbg-ops/NexxusFlow`
**Date:** November 2026
**Reference:** [https://github.com/rwilliamspbg-ops/NexxusFlow/pulls](https://github.com/rwilliamspbg-ops/NexxusFlow/pulls)

---

## Executive Summary

An audit of the 16 open pull requests (`#73` through `#89`) was conducted to determine why they failed CI and what changes are required.

### Key Takeaway
1. **The underlying feature code has already been merged into `main` and is working in production.**
   - PRs `#73`–`#76` attempted to add claim count badges and lifetime validity duration indicators. This feature was merged into `main` in PR `#105` and polished in subsequent PRs.
   - PRs `#79`–`#89` attempted to add interactive ISO 8601 timestamp copying, micro-actions, and accessibility controls. This feature was fully implemented and merged into `main` across PRs `#105`, `#106`, `#108`, and `#117`.
   - Every single check across Rust (`cargo fmt`, `clippy`, `cargo test`), TypeScript (`types-shared`), Go (`chapter-jwt-auth`), Docker Compose, and Frontend (`oxlint`, `vite build`) passes cleanly on `main`.

2. **Root Cause of Historical CI Failures on PRs #73–#89:**
   - The CI job `JWT Lab — Image Build, SBOM, and Scan` failed during the `aquasecurity/trivy-action@v0.36.0` vulnerability scanning step.
   - At the time those PR branches were created, Go 1.25.x stdlib had upstream unpatched CVEs (`CVE-2024-45338`, `CVE-2024-45337`, `CVE-2025-22868`, etc.) and the container image scanner failed with exit code 1 because `.trivyignore` had not yet been introduced into `main`.
   - Additionally, the Dockerfile builder image `golang:1.25-alpine` / `golang:1.25-bookworm` required migration to `golang:1-bookworm` and suppression via `.trivyignore` and `trivy.yaml`.
   - These infrastructure fixes were subsequently committed to `main`. Every CI run on `main` (e.g., runs `#285` and `#286` for PR `#117`) now passes 100% of jobs:
     - Rust — Lint, Test, Build (Success)
     - TypeScript — Build and Lint (Success)
     - JWT Lab — Go Lint, Test, and Compose Smoke (Success)
     - JWT Lab — Image Build, SBOM, and Scan (Success)
     - JWT Lab — Publish, Sign, and Attest Image (Success on push to `main`)

3. **Status of Open PRs:**
   - Because the feature code and CI fixes were subsequently landed on `main` via newer PRs (`#105`–`#117`), PRs `#73` through `#89` are completely **superseded and redundant**.
   - Attempting to merge them into `main` today would create conflicts or re-introduce outdated code structures.

---

## Detailed PR Breakdown

| PR # | Title | Head Branch | Status / Resolution |
|------|-------|-------------|---------------------|
| **#89** | 🎨 Palette: Add interactive click-to-copy ISO 8601 timestamps | `palette/interactive-timestamp-claims-7661608248914165722` | **Superseded.** ISO timestamp micro-actions and clipboard copy controls are fully integrated on `main`. |
| **#88** | 🎨 Palette: Make JWT timestamp claim summary bar interactive with ISO copying | `jules-3346506503769900160-14cd29fe` | **Superseded.** Merged via PRs #105, #106, #108. |
| **#87** | 🎨 Palette: Add interactive ISO 8601 timestamp copying to claim summary bar | `palette/interactive-timestamp-claims-17617480716333550437` | **Superseded.** Fully integrated on `main`. |
| **#86** | 🎨 Palette: Interactive ISO timestamp copy in claim summary | `palette/iso-timestamp-copy-17169392597021337683` | **Superseded.** Fully integrated on `main`. |
| **#85** | 🎨 Palette: Add interactive ISO 8601 timestamp copying to claims summary | `palette/interactive-timestamp-iso-copy-1441895073328070953` | **Superseded.** Fully integrated on `main`. |
| **#84** | 🎨 Palette: Make timestamp claim summary items interactive copy controls | `palette/interactive-timestamp-claims-4558621247965310312` | **Superseded.** Fully integrated on `main`. |
| **#83** | 🎨 Palette: Add interactive ISO timestamp copy controls for decoded token claims | `palette/interactive-timestamp-copy-controls-9851827317853873642` | **Superseded.** Fully integrated on `main`. |
| **#82** | 🎨 Palette: Add interactive ISO timestamp copy controls to decoded claims summary | `palette/timestamp-copy-controls-6779573741489325673` | **Superseded.** Fully integrated on `main`. |
| **#81** | 🎨 Palette: Add interactive ISO timestamp copy controls to JWT timestamp claims | `palette-interactive-timestamp-claims-12284042267724106955` | **Superseded.** Fully integrated on `main`. |
| **#80** | 🎨 Palette: Add interactive ISO 8601 timestamp copying to claims summary | `palette/interactive-timestamp-iso-copy-8144581972923759862` | **Superseded.** Fully integrated on `main`. |
| **#79** | 🎨 Palette: Add interactive copy micro-actions for token timestamp claims | `palette/timestamp-copy-micro-actions-13464386701297964602` | **Superseded.** Fully integrated on `main`. |
| **#77** | docs: PR failure audit report and local CI verification | `jules-548568870582018626-cec888c2` | **Superseded.** Historical audit attempt. |
| **#76** | 🎨 Palette: Add claim count badge and token lifetime duration to decoded claims | `palette/claims-count-lifetime-badge-5616091212569555426` | **Superseded.** Claim count badges and lifetime calculations merged via PR #105. |
| **#75** | 🎨 Palette: Add claim count badge and token lifetime summary | `palette/decoded-claims-badge-and-lifetime-9150265114125044439` | **Superseded.** Merged via PR #105. |
| **#74** | 🎨 Palette: Add inline claim count badge and token lifetime duration indicator | `jules-15273698793785270944-d692ba6a` | **Superseded.** Merged via PR #105. |
| **#73** | 🎨 Palette: add inline claim count badge and total token lifetime indicator | `palette/claim-count-badge-and-lifetime-8251420808495498957` | **Superseded.** Merged via PR #105. |

---

## Recommended Action for GitHub Maintainer

Since these pull requests are hosted on GitHub and require repo write/admin permissions to close:

1. **Close PRs #73–#89 as Superseded:**
   Navigate to each PR and close them with a comment:
   > *"Closing as superseded: The proposed changes (claim count badges, token lifetime calculation, interactive ISO 8601 timestamp copying, and Trivy scan fixes) have already been merged into `main` via PRs #105–#117, and CI is currently passing."*

2. **Clean up remote branches:**
   Delete the obsolete feature branches (`palette/*` and `jules-*`) to keep the repository clean.
