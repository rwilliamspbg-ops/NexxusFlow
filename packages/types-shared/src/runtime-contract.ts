import { z } from "zod";

export const failureCauseSchema = z.enum(["cpu", "memory", "disk"]);

export const narrativeMutationRequestSchema = z.object({
  type: z.enum(["inject_latency", "partition_network", "fail_node"]),
  delay_us: z.number().int().positive().optional(),
  channels: z.array(z.string().min(1)).optional(),
  node_id: z.string().min(1).optional(),
  cause: failureCauseSchema.optional(),
});

export const labStateSchema = z.object({
  latency_injected_ms: z.number().int().nonnegative().optional(),
  network_partitions: z.array(z.string()),
  node_failures: z.record(failureCauseSchema),
});

export const runtimeMetricsSnapshotSchema = z.object({
  auth_requests_total: z.number().int().nonnegative(),
  auth_success_total: z.number().int().nonnegative(),
  auth_failure_total: z.number().int().nonnegative(),
  alerts_received_total: z.number().int().nonnegative(),
  narrative_mutations_total: z.number().int().nonnegative(),
  narrative_mutation_failures_total: z.number().int().nonnegative(),
  rate_limit_rejections_total: z.number().int().nonnegative(),
  state_reads_total: z.number().int().nonnegative(),
  metrics_reads_total: z.number().int().nonnegative(),
  last_auth_processing_ns: z.number().int().nonnegative(),
  last_mutation_processing_ns: z.number().int().nonnegative(),
});

export const narrativeMutationResponseSchema = z.object({
  applied_mutation: narrativeMutationRequestSchema,
  state: labStateSchema,
  metrics: runtimeMetricsSnapshotSchema,
});

export type FailureCause = z.infer<typeof failureCauseSchema>;
export type NarrativeMutationRequest = z.infer<typeof narrativeMutationRequestSchema>;
export type LabStateSnapshot = z.infer<typeof labStateSchema>;
export type RuntimeMetricsSnapshot = z.infer<typeof runtimeMetricsSnapshotSchema>;
export type NarrativeMutationResponse = z.infer<typeof narrativeMutationResponseSchema>;
