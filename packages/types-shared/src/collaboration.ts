// packages/types-shared/src/collaboration.ts
import { z } from "zod";

/**
 * Schema for a collaborative lab session.
 * Each collaborator has a SINGLE permission level (not an array).
 */
export const collaborativeLabSchema = z.object({
  labChapterId: z.string(),
  collaborators: z.array(
    z.object({
      userId: z.string(),
      permissions: z.enum(["VIEW", "RUN_LAB", "INJECT_FAILURE"]),
      hasConsented: z.boolean(), // Explicit opt-in via UI dialog
    })
  ),
});

export type CollaborativeLab = z.infer<typeof collaborativeLabSchema>;

/**
 * Resource quotas enforced per chapter session.
 * maxCPUSecondsPerChapter triggers auto-rollback when exceeded.
 */
export const resourceQuotaSchema = z.object({
  maxCPUSecondsPerChapter: z.number().positive().default(30),
  memoryLimitBytes: z.number().positive().optional(),
});

export type ResourceQuota = z.infer<typeof resourceQuotaSchema>;

// ── Usage example (compile-time type checked) ────────────────────────────────
const _collaborativeLabExample: CollaborativeLab = {
  labChapterId: "path-1-sovereign-foundations.chapter-jwt-auth",
  collaborators: [
    {
      userId: "user@example.com",
      permissions: "VIEW", // single enum value — not an array
      hasConsented: true,
    },
  ],
};
