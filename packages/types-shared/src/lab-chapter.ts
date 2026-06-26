// packages/types-shared/src/lab-chapter.ts
import { z } from "zod";

export const labChapterSchema = z.object({
  id: z.string(),               // e.g. "path-1-sovereign-foundations.chapter-jwt-auth"
  title: z.string(),            // Display name for UI
  description: z.string(),      // Intro narrative text
  prereqs: z.array(z.string()), // e.g. ["jwt-basics"] or []
  simpleModeHint: z.boolean(),  // Enable/disable advanced features (MCR, eBPF)
  steps: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["narrative", "command", "lab-run", "decision"]),
      narrative: z.string().optional(),
      commands: z
        .array(
          z.object({
            exec: z.string(),        // Command to run
            description: z.string(), // What it does and why
          })
        )
        .default([]),
      decisionPoints: z
        .array(
          z.object({
            question: z.string(),
            options: z.array(
              z.object({
                label: z.string(),
                payload: z.union([z.boolean(), z.number()]),
              })
            ),
          })
        )
        .optional(),
      expectedOutcome: z.string().optional(),
      reflectionPrompt: z.string().optional(),
    })
  ),
});

export type LabChapter = z.infer<typeof labChapterSchema>;

// ── Usage example (compile-time type checked) ────────────────────────────────
const _jwtAuthChapterExample: LabChapter = {
  id: "path-1-sovereign-foundations.chapter-jwt-auth",
  title: "JWT Authentication Stack Deployment",
  description: "Learn to secure your backend services with JSON Web Tokens.",
  prereqs: [],
  simpleModeHint: false,
  steps: [
    {
      id: "narrative-intro",
      type: "narrative",
      narrative: "Before we start deploying the JWT auth stack...",
      commands: [],
      reflectionPrompt:
        "What are the benefits of using JWT tokens vs session cookies?",
    },
    {
      id: "command-docker-compose-jwt-stack",
      type: "command",
      commands: [
        {
          exec: "docker compose up -d jwt-auth-backend",
          description: "Starts the backend service with JWT middleware enabled.",
        },
      ],
    },
  ],
};
