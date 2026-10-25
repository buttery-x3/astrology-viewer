import { describe, expect, it } from 'vitest';
import { civilAtInstant, exampleBirthContext, formatOffset, makeBirthContext, type ObserverContext } from '../../src/lib/state/birth-context';
import { resolveCivilTime } from '../../src/lib/time/civil-time';

const observer: ObserverContext = { latitudeDeg: 40.7, longitudeDeg: -74, label: 'New York', zoneId: 'America/New_York', manualOffsetMinutes: null, source: 'manual', zoneOverride: true };

describe('birth anchor and pinned observer context', () => {
  it('retains the explicit later fold choice in an immutable birth anchor', () => {
    const civil = { year: 2024, month: 11, day: 3, hour: 1, minute: 30, second: 0 };
    const resolution = resolveCivilTime({ civil, zoneId: observer.zoneId });
    expect(resolution.status).toBe('ambiguous');
    if (resolution.status !== 'ambiguous') throw new Error('Expected a fold');
    const candidate = resolution.candidates[1]!;
    const birth = makeBirthContext({ instantMs: candidate.utcMs, civil, observer, timeKnown: true, resolution, candidate });
    expect(birth.resolution.choice).toBe('later');
    expect(birth.resolution.offsetMinutes).toBe(-300);
    expect(Object.isFrozen(birth)).toBe(true);
    expect(Object.isFrozen(birth.observer)).toBe(true);
    expect(Object.isFrozen(birth.civil)).toBe(true);
    expect(Object.isFrozen(birth.resolution.warnings)).toBe(true);
    expect(birth.provisionalReason).toBeNull();
  });

  it('preserves provisional noon and original observer independently of exploration objects', () => {
    const civil = { year: 2000, month: 6, day: 15, hour: 12, minute: 0, second: 0 };
    const enteredObserver = { ...observer };
    const resolution = resolveCivilTime({ civil, zoneId: enteredObserver.zoneId });
    if (resolution.status !== 'unique') throw new Error('Expected unique noon');
    const birth = makeBirthContext({ instantMs: resolution.candidate.utcMs, civil, observer: enteredObserver, timeKnown: false, resolution, candidate: resolution.candidate });
    enteredObserver.latitudeDeg = -33.86;
    civil.hour = 13;
    expect(birth.civil.hour).toBe(12);
    expect(birth.observer.latitudeDeg).toBe(40.7);
    expect(birth.provisionalReason).toContain('local noon');
    expect(birth.timeKnown).toBe(false);
  });

  it('converts a fixed instant with pinned historical seconds and with an explicit offset', () => {
    const instant = Date.UTC(1900, 0, 1);
    const amsterdam = civilAtInstant(instant, { zoneId: 'Europe/Amsterdam', manualOffsetMinutes: null });
    expect(amsterdam.civil).toMatchObject({ year: 1900, month: 1, day: 1, hour: 0, minute: 19, second: 32 });
    expect(formatOffset(amsterdam.offsetMinutes)).toBe('UTC+00:19:32');
    const manual = civilAtInstant(instant, { zoneId: 'America/New_York', manualOffsetMinutes: 330 });
    expect(manual.civil).toMatchObject({ hour: 5, minute: 30, second: 0 });
    expect(manual.offsetMinutes).toBe(330);
    expect(() => civilAtInstant(instant, { zoneId: 'Invalid/Zone', manualOffsetMinutes: null })).toThrow(/IANA/);
  });

  it('rejects an instant that does not match the chosen resolution', () => {
    const example = exampleBirthContext();
    const resolution = resolveCivilTime({ civil: example.civil, zoneId: example.observer.zoneId });
    if (resolution.status !== 'unique') throw new Error('Expected unique example');
    expect(() => makeBirthContext({ instantMs: resolution.candidate.utcMs + 1_000, civil: example.civil, observer: example.observer, timeKnown: true, resolution, candidate: resolution.candidate })).toThrow(/match/);
  });
});
