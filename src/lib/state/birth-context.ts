import { resolveCivilTime, timeZoneDatabase, type CivilDateTime, type CivilTimeCandidate, type CivilTimeProvenance, type CivilTimeResolution, type CivilTimeWarning } from '../time/civil-time';

export interface ObserverContext {
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly label: string;
  readonly zoneId: string;
  readonly manualOffsetMinutes: number | null;
  readonly source: 'manual' | 'search' | 'globe';
  readonly zoneOverride: boolean;
}

export interface MomentCommit {
  readonly instantMs: number;
  readonly civil: CivilDateTime;
  readonly observer: ObserverContext;
  readonly timeKnown: boolean;
  readonly candidate: CivilTimeCandidate;
  readonly resolution: CivilTimeResolution;
}

export interface GlobeDraft {
  readonly instantMs: number;
  readonly civil: CivilDateTime;
  readonly observer: ObserverContext;
  readonly timeKnown: boolean;
  readonly keepLocal: boolean;
}

export interface BirthContext {
  readonly instantMs: number;
  readonly civil: CivilDateTime;
  readonly observer: ObserverContext;
  readonly timeKnown: boolean;
  readonly provisionalReason: string | null;
  readonly resolution: {
    readonly offsetMinutes: number;
    readonly choice: 'unique' | 'earlier' | 'later' | 'manual';
    readonly provenance: CivilTimeProvenance;
    readonly warnings: readonly CivilTimeWarning[];
  };
}

export function formatOffset(offsetMinutes: number): string {
  const seconds = Math.round(Math.abs(offsetMinutes) * 60);
  const sign = offsetMinutes < 0 ? '−' : '+';
  const hours = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
  const remainder = seconds % 60;
  return `UTC${sign}${hours}:${minutes}${remainder ? `:${String(remainder).padStart(2, '0')}` : ''}`;
}

/** UTC -> local uses the same pinned rule singleton as the resolver, never browser tzdata. */
export function civilAtInstant(instantMs: number, observer: Pick<ObserverContext, 'zoneId' | 'manualOffsetMinutes'>): { civil: CivilDateTime; offsetMinutes: number } {
  if (!Number.isFinite(instantMs)) throw new RangeError('The instant must be finite.');
  const zone = observer.manualOffsetMinutes === null ? timeZoneDatabase.zone(observer.zoneId) : null;
  if (observer.manualOffsetMinutes === null && !zone) throw new RangeError('Choose a known IANA time zone.');
  const offsetMinutes = observer.manualOffsetMinutes ?? -zone!.utcOffset(instantMs);
  const date = new Date(instantMs + Math.round(offsetMinutes * 60_000));
  return { offsetMinutes, civil: { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() } };
}

export function civilDateValue(civil: CivilDateTime): string { return `${String(civil.year).padStart(4, '0')}-${String(civil.month).padStart(2, '0')}-${String(civil.day).padStart(2, '0')}`; }
export function civilTimeValue(civil: CivilDateTime): string { return `${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}:${String(civil.second ?? 0).padStart(2, '0')}`; }

export function makeBirthContext(commit: MomentCommit): BirthContext {
  if (commit.resolution.status !== 'unique' && commit.resolution.status !== 'ambiguous') throw new Error('A birth anchor needs a resolved civil time.');
  if (!commit.candidate.withinSupportedRange || !commit.resolution.candidates.some((candidate) => candidate.utcMs === commit.instantMs)) throw new Error('The birth instant must match a supported resolution candidate.');
  const index = commit.resolution.candidates.findIndex((candidate) => candidate.utcMs === commit.instantMs);
  const choice = commit.observer.manualOffsetMinutes !== null ? 'manual' : commit.resolution.status === 'ambiguous' ? index === 0 ? 'earlier' : 'later' : 'unique';
  return Object.freeze({
    instantMs: commit.instantMs, civil: Object.freeze({ ...commit.civil }), observer: Object.freeze({ ...commit.observer }),
    timeKnown: commit.timeKnown, provisionalReason: commit.timeKnown ? null : 'Birth time unknown; local noon is provisional.',
    resolution: Object.freeze({ offsetMinutes: commit.candidate.offsetMinutes, choice, provenance: Object.freeze({ ...commit.resolution.provenance }), warnings: Object.freeze(commit.resolution.warnings.map((warning) => Object.freeze({ ...warning }))) }),
  });
}

export function exampleBirthContext(): BirthContext {
  const civil = { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 };
  const observer: ObserverContext = { latitudeDeg: 51.5, longitudeDeg: 0, label: 'Greenwich', zoneId: 'Europe/London', manualOffsetMinutes: null, source: 'manual', zoneOverride: false };
  const resolution = resolveCivilTime({ civil, zoneId: observer.zoneId });
  if (resolution.status !== 'unique') throw new Error('The example civil time must be unique.');
  return makeBirthContext({ instantMs: resolution.candidate.utcMs, civil, observer, timeKnown: true, candidate: resolution.candidate, resolution });
}
