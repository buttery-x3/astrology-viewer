import { describe, expect, it } from 'vitest';
import { calculationRequestSchema, chartInputSchema } from '../../src/lib/workers/protocol';

describe('calculation protocol boundary', () => {
  const request = { type: 'calculate', revision: 1, instantMs: Date.UTC(2000, 0, 1, 12), observer: { latitudeDeg: 51.5, longitudeDeg: 0 } };
  it('retains the M0 harness request while accepting explicit supported systems', () => {
    expect(calculationRequestSchema.safeParse(request).success).toBe(true);
    expect(calculationRequestSchema.safeParse({ ...request, systems: ['W', 'E', 'O', 'P', 'K', 'R', 'C'] }).success).toBe(true);
    expect(calculationRequestSchema.safeParse({ type: 'init', revision: 0 }).success).toBe(true);
  });
  it('rejects unsupported or ambiguous payloads before any engine calls', () => {
    for (const payload of [
      null, { type: 'unknown', revision: 0 }, { ...request, revision: -1 }, { ...request, revision: 1.5 },
      { ...request, instantMs: Date.UTC(2101, 0, 1) }, { ...request, instantMs: Number.NaN },
      { ...request, instantMs: request.instantMs + 0.5 },
      { ...request, observer: { latitudeDeg: 91, longitudeDeg: 0 } },
      { ...request, observer: { latitudeDeg: 0, longitudeDeg: -181 } },
      { ...request, systems: [] }, { ...request, systems: ['W', 'W'] }, { ...request, systems: ['X'] },
      { ...request, unexpected: true },
    ]) expect(calculationRequestSchema.safeParse(payload).success).toBe(false);
  });
  it('uses the same bounds for committed chart inputs', () => {
    expect(chartInputSchema.safeParse({ instantMs: Date.UTC(1900, 0, 1), observer: request.observer, system: 'W', comparisonSystem:null }).success).toBe(true);
    expect(chartInputSchema.safeParse({ instantMs: Date.UTC(1900, 0, 1) - 1, observer: request.observer, system: 'W', comparisonSystem:null }).success).toBe(false);
    expect(chartInputSchema.safeParse({ instantMs: request.instantMs, observer: request.observer, system: 'W', comparisonSystem:'W' }).success).toBe(false);
  });
});
