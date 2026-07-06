import fs from 'fs';
import { z } from 'zod';
import {
  labStateSchema,
  runtimeMetricsSnapshotSchema,
  narrativeMutationRequestSchema,
  narrativeMutationResponseSchema
} from './runtime-contract.js';

const schemas: Record<string, z.ZodTypeAny> = {
  'lab-state': labStateSchema,
  'metrics': runtimeMetricsSnapshotSchema,
  'mutation-request': narrativeMutationRequestSchema,
  'mutation-response': narrativeMutationResponseSchema
};

function main() {
  const schemaName = process.argv[2];
  if (!schemaName || !schemas[schemaName]) {
    console.error(`Usage: node validate-payload.js <schema-name>`);
    console.error(`Available schemas: ${Object.keys(schemas).join(', ')}`);
    process.exit(1);
  }

  const schema = schemas[schemaName];
  const input = fs.readFileSync(0, 'utf-8');

  try {
    const json = JSON.parse(input);
    const result = schema.safeParse(json);
    if (!result.success) {
      console.error('❌ Validation failed:');
      console.error(JSON.stringify(result.error.format(), null, 2));
      process.exit(1);
    }
    console.log('✅ Validation successful');
  } catch (e) {
    console.error('❌ Invalid JSON input');
    process.exit(1);
  }
}

main();
