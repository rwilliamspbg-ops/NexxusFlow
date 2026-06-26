# Contributing to NexusFlow — Community Contributions  

## Module Submission Requirements  
- All community modules must pass CI lint checks (clippy/eslint) before merge request creation.  
- Core team reserves right to reject modules lacking production-grade examples or proper error handling patterns.  
- Minimum 1 LGTM approval from core maintainer required for first-time contributors; subsequent PRs can bypass if previous contributions reviewed and merged successfully without incident reports.  

## Code Quality Standards  
- Zero-copy hot path implementations must pass `cargo audit` + static analysis (e.g., `clippy::alloc_heresy`).  
- TypeScript types generated via Zod schemas should use fixed-size buffers where applicable to avoid heap allocation in data paths.  
