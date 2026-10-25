import { z } from 'zod';
import { validateRotationMatrix, type Matrix3 } from '../astronomy/coordinates';
import type { EphemerisSnapshot } from '../astronomy/ephemeris';

const finite = z.number().finite();
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const angle = finite.min(0).lt(360);
const latitude = finite.min(-90).max(90);
export const houseSystemSchema = z.enum(['W', 'E', 'O', 'P', 'K', 'R', 'C']);
export const bodyIdSchema = z.enum(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
export const observerSchema = z.object({ latitudeDeg: latitude, longitudeDeg: finite.min(-180).max(180) }).strict();
export const instantSchema = finite.int().min(Date.UTC(1900, 0, 1)).lt(Date.UTC(2101, 0, 1));

export const chartInputSchema = z.object({ instantMs: instantSchema, observer: observerSchema, system: houseSystemSchema, comparisonSystem: houseSystemSchema.nullable() }).strict().refine(value=>value.comparisonSystem!==value.system,'Choose distinct primary and comparison systems.');
export type ExplorerInput = z.infer<typeof chartInputSchema>;
export const explorerInputPatchSchema = z.object({instantMs:instantSchema.optional(),observer:observerSchema.partial().optional(),system:houseSystemSchema.optional(),comparisonSystem:houseSystemSchema.nullable().optional()}).strict();

export const calculationRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('init'), revision }).strict(),
  z.object({
    type: z.literal('calculate'), revision, instantMs: instantSchema, observer: observerSchema,
    systems: z.array(houseSystemSchema).min(1).max(7).refine((systems) => new Set(systems).size === systems.length, 'House systems must be unique.').optional(),
  }).strict(),
]);
export type CalculationRequest = z.infer<typeof calculationRequestSchema>;
/** Compatibility export for the M0 worker harness. */
export type CalculationMessage = CalculationRequest;

const equatorialSchema = z.object({ rightAscensionDeg: angle, declinationDeg: latitude }).strict();
const rotationSchema = z.tuple([finite, finite, finite, finite, finite, finite, finite, finite, finite]).refine((rotation) => {
  try { validateRotationMatrix(rotation as Matrix3); return true; } catch { return false; }
}, 'Invalid equatorial frame rotation.');
const validHousesSchema = z.object({
  system: houseSystemSchema, status: z.literal('valid'), cusps: z.array(angle).length(12),
  ascendantDeg: angle, midheavenDeg: angle, armcDeg: angle,
}).strict();
const undefinedHousesSchema = z.object({ system: houseSystemSchema, status: z.literal('undefined'), reason: z.string().min(1) }).strict();

export const ephemerisSnapshotSchema: z.ZodType<EphemerisSnapshot> = z.object({
  instantMs: instantSchema, observer: observerSchema,
  time: z.object({
    julianDateTt: finite, julianDateUt1: finite, inputJulianDate: finite,
    interpretation: z.enum(['historical-ut1', 'utc-leap-table', 'future-ut1-assumption']),
    deltaTSeconds: finite, tidalAcceleration: z.literal(-25.8),
  }).strict(),
  greenwichSiderealTimeDeg: angle, trueObliquityDeg: finite,
  frame: z.object({
    from: z.literal('equatorial-of-date'), to: z.literal('equatorial-j2000'),
    julianDateTt: finite, ofDateKind: z.enum(['mean', 'true']), source: z.string().min(1), rotation: rotationSchema,
  }).strict(),
  bodies: z.array(z.object({
    id: bodyIdSchema, longitudeDeg: angle, latitudeDeg: latitude, distanceAu: finite.positive(),
    longitudeSpeedDegPerDay: finite, effectiveFlags: z.number().int().nonnegative(),
    equatorial: equatorialSchema, fixedEquatorial: equatorialSchema,
    horizon: z.object({ east: finite, north: finite, up: finite, azimuthDeg: angle.nullable(), altitudeDeg: latitude }).strict(),
  }).strict()).length(10).refine((bodies) => new Set(bodies.map((body) => body.id)).size === 10, 'Expected every body exactly once.'),
  houses: z.array(z.discriminatedUnion('status', [validHousesSchema, undefinedHousesSchema])).min(1).max(7)
    .refine((houses) => new Set(houses.map((house) => house.system)).size === houses.length, 'Expected unique house systems.'),
  provenance: z.object({
    engine: z.string().min(1), revision: z.string().min(1), calculation: z.string().min(1),
    data: z.tuple([
      z.object({ name: z.literal('sepl_18.se1'), sha256: z.literal('ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66') }).strict(),
      z.object({ name: z.literal('semo_18.se1'), sha256: z.literal('1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7') }).strict(),
    ]),
  }).strict(),
}).strict();

export const calculationResponseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), revision, version: z.string().min(1), heapBytes: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('result'), revision, snapshot: ephemerisSnapshotSchema, calculationMs: finite.nonnegative(), heapBytes: z.number().int().positive() }).strict(),
  z.object({ type: z.literal('error'), revision, error: z.string().min(1).max(4096) }).strict(),
]);
export type CalculationResponse = z.infer<typeof calculationResponseSchema>;
