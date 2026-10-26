import moment from 'moment-timezone/moment-timezone.js';
import packedTimezones from './data/tzdata-2026e-backzone.json';
import timezoneManifest from './data/manifest.json';

// Import the no-data entry point so the ordinary package bundle cannot merge
// historically distinct backzone identities or add a second dataset to the app.
moment.tz.load(packedTimezones);
export const timeZoneDatabase = moment.tz;
export const TZDATA_VERSION = timezoneManifest.ianaVersion;
export const TZDATA_MANIFEST = timezoneManifest;

export const MIN_SUPPORTED_UTC_MS = Date.UTC(1900, 0, 1);
export const MAX_SUPPORTED_UTC_MS_EXCLUSIVE = Date.UTC(2101, 0, 1);

export interface CivilDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second?: number;
}

export interface CivilTimeInput {
  readonly civil: CivilDateTime;
  readonly zoneId?: string;
  /** East-positive minutes from UTC; explicitly overrides any zoneId. */
  readonly manualOffsetMinutes?: number;
}

export interface CivilTimeCandidate {
  readonly utcMs: number;
  readonly utcIso: string;
  /** East-positive. Historical IANA offsets may include fractional minutes. */
  readonly offsetMinutes: number;
  readonly abbreviation: string;
  readonly withinSupportedRange: boolean;
}

export type CivilTimeWarningCode =
  | 'pre-1970-history'
  | 'pre-utc-reference'
  | 'future-rule-projection'
  | 'manual-offset';

export interface CivilTimeWarning {
  readonly code: CivilTimeWarningCode;
  readonly message: string;
}

export interface CivilTimeProvenance {
  readonly source: 'iana-tzdata' | 'manual-offset' | 'unresolved';
  readonly zoneId: string | null;
  readonly tzdataVersion: string;
  readonly adapterVersion: string;
  readonly calendar: 'proleptic-gregorian';
  readonly historicalLimitation: string;
}

interface ResolutionBase {
  readonly candidates: readonly CivilTimeCandidate[];
  readonly warnings: readonly CivilTimeWarning[];
  readonly provenance: CivilTimeProvenance;
}

export interface CivilTimeGap {
  readonly startCivilIso: string;
  readonly endCivilIso: string;
  readonly durationMinutes: number;
  readonly beforeOffsetMinutes: number;
  readonly afterOffsetMinutes: number;
}

export type CivilTimeResolution =
  | (ResolutionBase & { readonly status: 'unique'; readonly candidate: CivilTimeCandidate })
  | (ResolutionBase & { readonly status: 'ambiguous' })
  | (ResolutionBase & { readonly status: 'nonexistent'; readonly gap: CivilTimeGap | null; readonly message: string })
  | (ResolutionBase & { readonly status: 'invalid'; readonly code: 'invalid-calendar' | 'invalid-zone' | 'invalid-offset' | 'outside-supported-range'; readonly message: string });

export interface CivilTimeResolutionOptions {
  /** Injectable clock for deterministic future-rule provenance tests. */
  readonly nowUtcMs?: number;
}

const MINUTE_MS = 60_000;
const HISTORICAL_LIMITATION = 'The IANA dataset includes backzone histories for zone.tab identities. Historical civil-time records and geographic boundaries remain approximate, and backzone entries can be uncertain; these rules do not establish the accuracy of a recorded birth time.';

function isSupported(utcMs: number): boolean {
  return utcMs >= MIN_SUPPORTED_UTC_MS && utcMs < MAX_SUPPORTED_UTC_MS_EXCLUSIVE;
}

function provenance(input: CivilTimeInput): CivilTimeProvenance {
  return {
    source: input.manualOffsetMinutes !== undefined ? 'manual-offset' : input.zoneId ? 'iana-tzdata' : 'unresolved',
    zoneId: input.zoneId ?? null,
    tzdataVersion: moment.tz.dataVersion,
    adapterVersion: 'civil-time-v2-backzone',
    calendar: 'proleptic-gregorian',
    historicalLimitation: HISTORICAL_LIMITATION,
  };
}

function invalid(
  base: ResolutionBase,
  code: Extract<CivilTimeResolution, { status: 'invalid' }>['code'],
  message: string,
): CivilTimeResolution {
  return { ...base, status: 'invalid', code, message };
}

/** Numeric construction only: Date never parses user text or normalizes invalid calendar fields. */
function civilEpoch(civil: CivilDateTime): number | null {
  if (!civil || typeof civil !== 'object') return null;
  const fields = [civil.year, civil.month, civil.day, civil.hour, civil.minute, civil.second === undefined ? 0 : civil.second];
  if (!fields.every(Number.isInteger)) return null;
  const [year, month, day, hour, minute, second] = fields as [number, number, number, number, number, number];
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

function warningsFor(input: CivilTimeInput, candidates: readonly CivilTimeCandidate[], localEpochMs: number, nowUtcMs: number): CivilTimeWarning[] {
  const warnings: CivilTimeWarning[] = [];
  if (input.manualOffsetMinutes !== undefined) {
    warnings.push({ code: 'manual-offset', message: 'This explicit UTC offset overrides time-zone and daylight-saving rules.' });
  }
  if (localEpochMs < Date.UTC(1970, 0, 1)) {
    warnings.push({ code: 'pre-1970-history', message: HISTORICAL_LIMITATION });
  }
  if (localEpochMs < Date.UTC(1960, 0, 1)) {
    warnings.push({ code: 'pre-utc-reference', message: 'The UTC-labelled instant is a computational civil-time reference; UTC did not exist as a historical clock standard at this date.' });
  }
  if (input.manualOffsetMinutes === undefined && (candidates.some((candidate) => candidate.utcMs > nowUtcMs) || (candidates.length === 0 && localEpochMs > nowUtcMs))) {
    warnings.push({ code: 'future-rule-projection', message: 'Future civil-time rules are projected from the packaged tzdata and may change by law.' });
  }
  return warnings;
}

function candidate(utcMs: number, offsetMinutes: number, abbreviation: string): CivilTimeCandidate {
  return { utcMs, utcIso: new Date(utcMs).toISOString(), offsetMinutes: offsetMinutes === 0 ? 0 : offsetMinutes, abbreviation, withinSupportedRange: isSupported(utcMs) };
}

function resultForCandidates(base: ResolutionBase, candidates: CivilTimeCandidate[]): CivilTimeResolution {
  if (!candidates.some((entry) => entry.withinSupportedRange)) {
    return invalid({ ...base, candidates }, 'outside-supported-range', 'The converted UTC instant must be from 1900-01-01 inclusive through 2100-12-31 inclusive.');
  }
  if (candidates.length === 1) return { ...base, candidates, status: 'unique', candidate: candidates[0]! };
  // Keep every fold candidate. A range boundary must not silently resolve ambiguity.
  return { ...base, candidates, status: 'ambiguous' };
}

function findGap(zone: moment.MomentZone, localEpochMs: number): CivilTimeGap | null {
  for (let index = 0; index < zone.untils.length - 1; index += 1) {
    const transition = zone.untils[index]!;
    if (!Number.isFinite(transition)) continue;
    const beforeOffset = zone.offsets[index]!;
    const afterOffset = zone.offsets[index + 1]!;
    const beforeLocal = transition - Math.round(beforeOffset * MINUTE_MS);
    const afterLocal = transition - Math.round(afterOffset * MINUTE_MS);
    if (afterLocal > beforeLocal && localEpochMs >= beforeLocal && localEpochMs < afterLocal) {
      return {
        startCivilIso: new Date(beforeLocal).toISOString().slice(0, -1),
        endCivilIso: new Date(afterLocal).toISOString().slice(0, -1),
        durationMinutes: (afterLocal - beforeLocal) / MINUTE_MS,
        beforeOffsetMinutes: -beforeOffset,
        afterOffsetMinutes: -afterOffset,
      };
    }
  }
  return null;
}

/**
 * Enumerate every offset in the zone's complete rule table, then round-trip each
 * UTC candidate against the rule active at that instant. Never use Moment's
 * convenience parsing: it silently shifts gaps and picks one side of folds.
 */
export function resolveCivilTime(input: CivilTimeInput, options: CivilTimeResolutionOptions = {}): CivilTimeResolution {
  const empty: ResolutionBase = { candidates: [], warnings: [], provenance: provenance(input) };
  const localEpochMs = civilEpoch(input.civil);
  if (localEpochMs === null) return invalid(empty, 'invalid-calendar', 'Enter a valid Gregorian date and time. Seconds must be 0–59; literal leap seconds are unsupported.');
  const nowUtcMs = Number.isFinite(options.nowUtcMs) ? options.nowUtcMs! : Date.now();

  if (input.manualOffsetMinutes !== undefined) {
    const offset = input.manualOffsetMinutes;
    if (!Number.isInteger(offset) || Math.abs(offset) > 14 * 60) {
      return invalid(empty, 'invalid-offset', 'A manual offset must be a whole number of minutes between UTC−14:00 and UTC+14:00.');
    }
    const candidates = [candidate(localEpochMs - offset * MINUTE_MS, offset, 'manual')];
    const warnings = warningsFor(input, candidates, localEpochMs, nowUtcMs);
    return resultForCandidates({ ...empty, warnings }, candidates);
  }

  const zone = typeof input.zoneId === 'string' ? moment.tz.zone(input.zoneId) : null;
  if (!zone) return invalid(empty, 'invalid-zone', 'Select a known IANA time zone or supply an explicit UTC offset.');
  const candidates: CivilTimeCandidate[] = [];
  const seen = new Set<number>();
  for (const offsetWestMinutes of new Set(zone.offsets)) {
    const utcMs = localEpochMs + Math.round(offsetWestMinutes * MINUTE_MS);
    const activeOffsetWestMinutes = zone.utcOffset(utcMs);
    if (Math.abs(utcMs - Math.round(activeOffsetWestMinutes * MINUTE_MS) - localEpochMs) > 0.5 || seen.has(utcMs)) continue;
    seen.add(utcMs);
    candidates.push(candidate(utcMs, -activeOffsetWestMinutes, zone.abbr(utcMs)));
  }
  candidates.sort((a, b) => a.utcMs - b.utcMs);
  const base = { ...empty, warnings: warningsFor(input, candidates, localEpochMs, nowUtcMs) };
  if (candidates.length === 0) {
    return { ...base, status: 'nonexistent', gap: findGap(zone, localEpochMs), message: 'This local time did not occur because the clock moved forward. Choose an existing civil time or an explicit manual offset.' };
  }
  return resultForCandidates(base, candidates);
}
