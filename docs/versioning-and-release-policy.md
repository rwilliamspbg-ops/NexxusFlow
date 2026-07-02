# Versioning and Release Policy

This repository now has enough moving parts that release expectations need to be
explicit.

## Current Policy

- Repository-level milestone tags should use `v0.x.y` while the repo remains pre-production.
- The JWT lab runtime should be versioned as a pre-1.0 service until staging promotion and deployment automation exist.
- Shared TypeScript schemas should be treated as contract-sensitive and only change in backward-compatible ways within the same minor line.
- Rust prototype crates may change quickly, but breaking changes should still be documented in release notes.

## Recommended Version Boundaries

| Surface | Recommended versioning rule |
| --- | --- |
| Repository milestone | `v0.x.y` |
| JWT auth lab runtime | `0.x.y` until production controls exist |
| TypeScript shared schemas | `0.x.y`, bump minor for additive schema changes and major for breaking contract changes |
| Rust prototype crates | `0.x.y`, bump minor for new prototype APIs and major for breaking API changes |

## Release Note Minimums

Every release or milestone note should state:

- validated commands actually run
- changed surfaces
- known gaps remaining
- whether contract, runtime, or container behavior changed

## Promotion Rules

The JWT lab runtime should not move past a pre-1.0 designation until:

1. staging deployment is repeatable
2. secrets are injected from a managed source
3. image provenance is enforced
4. rollback has been exercised, not just documented
