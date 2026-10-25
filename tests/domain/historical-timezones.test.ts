import { describe, expect, it } from 'vitest';
import { resolveCivilTime, timeZoneDatabase, TZDATA_MANIFEST, TZDATA_VERSION } from '../../src/lib/time/civil-time';

describe('pinned IANA backzone data', () => {
  it('records the exact source and build policy while retaining every tailored identity', () => {
    expect(TZDATA_VERSION).toBe('2026e');
    expect(TZDATA_MANIFEST).toMatchObject({ packratData: 'backzone', packratList: 'zone.tab', zoneCount: 598 });
    expect(timeZoneDatabase.names()).toHaveLength(598);
    expect(TZDATA_MANIFEST.verifiedPeriods).toBeGreaterThan(60_000);
    expect(TZDATA_MANIFEST.packing.precision).toMatch(/One second/);
  });

  it.each([
    ['Europe/Amsterdam', '1900-01-01T11:40:28.000Z', 1172],
    ['Asia/Aden', '1900-01-01T09:00:06.000Z', 10794],
    ['Asia/Riyadh', '1900-01-01T08:53:08.000Z', 11212],
    ['Africa/Accra', '1900-01-01T12:00:52.000Z', -52],
  ] as const)('preserves %s history that ordinary builds may merge', (zoneId, expectedUtc, secondsEast) => {
    const result = resolveCivilTime({ civil: { year: 1900, month: 1, day: 1, hour: 12, minute: 0 }, zoneId });
    expect(result.status).toBe('unique');
    expect(result.candidates[0]?.utcIso).toBe(expectedUtc);
    expect(result.candidates[0]!.offsetMinutes * 60).toBeCloseTo(secondsEast, 8);
    expect(result.provenance.adapterVersion).toBe('civil-time-v2-backzone');
    expect(result.warnings.map((entry) => entry.code)).toContain('pre-1970-history');
    expect(result.provenance.historicalLimitation).toMatch(/uncertain/);
  });

  it('distinguishes both sides of an Amsterdam twenty-eight-second gap', () => {
    const base = { year: 1937, month: 7, day: 1, hour: 0, minute: 0 };
    const gap = resolveCivilTime({ civil: { ...base, second: 15 }, zoneId: 'Europe/Amsterdam' });
    expect(gap.status).toBe('nonexistent');
    if (gap.status !== 'nonexistent') throw new Error('Expected second-resolution gap');
    expect(gap.gap?.durationMinutes).toBeCloseTo(28 / 60, 12);
    expect(gap.gap?.startCivilIso).toBe('1937-07-01T00:00:00.000');
    expect(gap.gap?.endCivilIso).toBe('1937-07-01T00:00:28.000');
    const after = resolveCivilTime({ civil: { ...base, second: 28 }, zoneId: 'Europe/Amsterdam' });
    expect(after.candidates[0]?.utcIso).toBe('1937-06-30T22:40:28.000Z');
  });

  it('retains Aden’s six-second transition rather than inheriting Riyadh’s rules', () => {
    const gap = resolveCivilTime({ civil: { year: 1950, month: 1, day: 1, hour: 0, minute: 0, second: 3 }, zoneId: 'Asia/Aden' });
    expect(gap.status).toBe('nonexistent');
    if (gap.status !== 'nonexistent') throw new Error('Expected Aden gap');
    expect(gap.gap?.durationMinutes).toBeCloseTo(0.1, 12);
    const riyadh = resolveCivilTime({ civil: { year: 1950, month: 1, day: 1, hour: 0, minute: 0, second: 3 }, zoneId: 'Asia/Riyadh' });
    expect(riyadh.status).toBe('unique');
  });

  it('expands future rules to 2100 instead of freezing at TZif’s 2038 boundary', () => {
    const summer = resolveCivilTime({ civil: { year: 2100, month: 7, day: 1, hour: 12, minute: 0 }, zoneId: 'Europe/Amsterdam' }, { nowUtcMs: Date.UTC(2026, 9, 25) });
    expect(summer.candidates[0]?.offsetMinutes).toBe(120);
    expect(summer.warnings.map((entry) => entry.code)).toContain('future-rule-projection');
    const winnipeg = resolveCivilTime({ civil: { year: 2100, month: 1, day: 1, hour: 12, minute: 0 }, zoneId: 'America/Winnipeg' });
    expect(winnipeg.candidates[0]?.offsetMinutes).toBe(-300);
  });
});
