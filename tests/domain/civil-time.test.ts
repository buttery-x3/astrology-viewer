import { describe, expect, it } from 'vitest';
import {
  MAX_SUPPORTED_UTC_MS_EXCLUSIVE, MIN_SUPPORTED_UTC_MS, resolveCivilTime,
  type CivilDateTime, type CivilTimeInput,
} from '../../src/lib/time/civil-time';

const NOW = Date.UTC(2026, 9, 25);
function resolve(civil: CivilDateTime, zoneId = 'Etc/UTC') {
  return resolveCivilTime({ civil, zoneId }, { nowUtcMs: NOW });
}
const civil = (year: number, month = 1, day = 1, hour = 12, minute = 0, second = 0): CivilDateTime => ({ year, month, day, hour, minute, second });

describe('civil-time folds and gaps', () => {
  it.each([
    ['Australia/Sydney', civil(2026, 4, 5, 2, 30), ['2026-04-04T15:30:00.000Z', '2026-04-04T16:30:00.000Z'], [660, 600]],
    ['America/New_York', civil(2026, 11, 1, 1, 30), ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z'], [-240, -300]],
    ['Australia/Lord_Howe', civil(2026, 4, 5, 1, 45), ['2026-04-04T14:45:00.000Z', '2026-04-04T15:15:00.000Z'], [660, 630]],
  ] as const)('enumerates both %s fold candidates', (zone, local, utcIsos, offsets) => {
    const result = resolve(local, zone);
    expect(result.status).toBe('ambiguous');
    expect(result.candidates.map((entry) => entry.utcIso)).toEqual(utcIsos);
    expect(result.candidates.map((entry) => entry.offsetMinutes)).toEqual(offsets);
    expect(result.candidates.every((entry) => entry.withinSupportedRange)).toBe(true);
  });

  it.each([
    ['Australia/Sydney', civil(2026, 10, 4, 2, 30), 60],
    ['America/New_York', civil(2026, 3, 8, 2, 30), 60],
    ['Australia/Lord_Howe', civil(2026, 10, 4, 2, 15), 30],
    ['Pacific/Apia', civil(2011, 12, 30), 1440],
  ] as const)('reports the actual %s gap without moving the input', (zone, local, minutes) => {
    const result = resolve(local, zone);
    expect(result.status).toBe('nonexistent');
    expect(result.candidates).toEqual([]);
    if (result.status !== 'nonexistent') throw new Error('Expected gap result');
    expect(result.gap?.durationMinutes).toBe(minutes);
    expect(result.gap!.afterOffsetMinutes - result.gap!.beforeOffsetMinutes).toBe(minutes);
  });

  it('uses the active transition rule at exact boundaries', () => {
    const before = resolve(civil(2026, 3, 8, 1, 59, 59), 'America/New_York');
    const after = resolve(civil(2026, 3, 8, 3, 0, 0), 'America/New_York');
    expect(before.candidates[0]?.utcIso).toBe('2026-03-08T06:59:59.000Z');
    expect(after.candidates[0]?.utcIso).toBe('2026-03-08T07:00:00.000Z');
    expect(resolve(civil(2026, 11, 1, 2, 0), 'America/New_York').status).toBe('unique');
  });

  it('preserves both candidates of the Paris 1911 fold with a second-resolution offset', () => {
    const result = resolve(civil(1911, 3, 10, 23, 55), 'Europe/Paris');
    expect(result.status).toBe('ambiguous');
    expect(result.candidates.map((entry) => entry.utcIso)).toEqual([
      '1911-03-10T23:45:39.000Z', '1911-03-10T23:55:00.000Z',
    ]);
    expect(result.candidates.map((entry) => entry.offsetMinutes)).toEqual([9.35, 0]);
  });
});

describe('offsets and rule provenance', () => {
  it('preserves quarter-hour modern and second-resolution historical offsets', () => {
    const kathmandu = resolve(civil(2026, 1, 1), 'Asia/Kathmandu');
    expect(kathmandu.status).toBe('unique');
    expect(kathmandu.candidates[0]?.offsetMinutes).toBe(345);
    expect(kathmandu.candidates[0]?.utcIso).toBe('2026-01-01T06:15:00.000Z');
    const paris = resolve(civil(1900, 1, 1), 'Europe/Paris');
    expect(paris.candidates[0]?.utcIso).toBe('1900-01-01T11:50:39.000Z');
    expect(paris.candidates[0]?.offsetMinutes).toBeCloseTo(9.35, 10);
    expect(paris.warnings.map((entry) => entry.code)).toContain('pre-1970-history');
    expect(paris.warnings.map((entry) => entry.code)).toContain('pre-utc-reference');
    expect(paris.provenance.historicalLimitation).toMatch(/merge pre-1970/);
  });

  it('records dataset version and future projections without depending on the machine zone', () => {
    const result = resolve(civil(2100, 7, 1), 'America/New_York');
    expect(result.status).toBe('unique');
    expect(result.provenance.tzdataVersion).toMatch(/^\d{4}[a-z]+$/);
    expect(result.provenance.calendar).toBe('proleptic-gregorian');
    expect(result.warnings.map((entry) => entry.code)).toContain('future-rule-projection');
    expect(result.candidates[0]?.utcIso).toBe('2100-07-01T16:00:00.000Z');
  });

  it('manual east-positive offset deliberately bypasses a gap and bad zone ID', () => {
    const result = resolveCivilTime({ civil: civil(2026, 3, 8, 2, 30), zoneId: 'invalid', manualOffsetMinutes: -300 }, { nowUtcMs: NOW });
    expect(result.status).toBe('unique');
    expect(result.candidates[0]?.utcIso).toBe('2026-03-08T07:30:00.000Z');
    expect(result.provenance.source).toBe('manual-offset');
    expect(result.warnings.map((entry) => entry.code)).toContain('manual-offset');
    expect(result.warnings.map((entry) => entry.code)).not.toContain('future-rule-projection');
  });
});

describe('Gregorian validation and converted UTC range', () => {
  it.each([1900, 2100])('rejects February 29 in non-leap century %i', (year) => {
    expect(resolve(civil(year, 2, 29)).status).toBe('invalid');
  });

  it('accepts February 29 in 2000 and rejects impossible or overflowed fields', () => {
    expect(resolve(civil(2000, 2, 29)).status).toBe('unique');
    for (const bad of [civil(2000, 0, 1), civil(2000, 13, 1), civil(2000, 4, 31), civil(2000, 1, 0), civil(2000, 1, 1, 24), civil(2000, 1, 1, 12, 60), civil(2000, 1, 1, 12, 0, 60), civil(NaN), civil(2000.5)]) {
      const result = resolve(bad);
      expect(result.status).toBe('invalid');
      if (result.status === 'invalid') expect(result.code).toBe('invalid-calendar');
    }
  });

  it('validates converted UTC instead of merely requiring local years 1900–2100', () => {
    const lower = resolveCivilTime({ civil: civil(1899, 12, 31, 14), manualOffsetMinutes: -600 });
    expect(lower.status).toBe('unique');
    expect(lower.candidates[0]?.utcMs).toBe(MIN_SUPPORTED_UTC_MS);
    const upper = resolveCivilTime({ civil: civil(2101, 1, 1, 13, 59, 59), manualOffsetMinutes: 840 });
    expect(upper.status).toBe('unique');
    expect(upper.candidates[0]?.utcMs).toBe(MAX_SUPPORTED_UTC_MS_EXCLUSIVE - 1000);
    const tooEarly = resolveCivilTime({ civil: civil(1900, 1, 1, 0), manualOffsetMinutes: 60 });
    const tooLate = resolveCivilTime({ civil: civil(2101, 1, 1, 14), manualOffsetMinutes: 840 });
    expect(tooEarly.status).toBe('invalid');
    expect(tooLate.status).toBe('invalid');
    if (tooEarly.status === 'invalid') expect(tooEarly.code).toBe('outside-supported-range');
    if (tooLate.status === 'invalid') expect(tooLate.code).toBe('outside-supported-range');
    expect(tooLate.candidates[0]?.withinSupportedRange).toBe(false);
  });

  it('rejects missing/unknown zones and malformed manual offsets', () => {
    const badInputs: CivilTimeInput[] = [
      { civil: civil(2000) }, { civil: civil(2000), zoneId: 'Mars/Olympus' },
      ...[841, -841, 1.5, NaN, Infinity].map((manualOffsetMinutes) => ({ civil: civil(2000), manualOffsetMinutes })),
    ];
    for (const input of badInputs) expect(resolveCivilTime(input).status).toBe('invalid');
  });
});
