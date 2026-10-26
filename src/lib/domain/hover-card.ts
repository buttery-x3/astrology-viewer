import { getContent, getSupplementalClaim, type ContentClaim } from '../content';
import { getProjectExplanation } from '../content/project-explanations';
import {
  BODY_IDS,
  HOUSE_SYSTEMS,
  type BodyId,
  type EphemerisSnapshot,
  type HouseResult,
} from '../astronomy/ephemeris';
import { normalizeDegrees, vectorToEquatorial } from '../astronomy/coordinates';
import { CATALOGUE_STARS, CONSTELLATIONS, catalogueStarDirection, type CatalogueStar } from '../scene/sky-data';
import { getAspectDetails } from './aspect-presentation';
import {
  classifyLongitude,
  ASPECT_TYPES,
  housePartition,
  zodiacSign,
  DEFAULT_ORBS,
  type AspectTypeId,
  type OrbSettings,
} from './chart';
import { getSkyReferences, type SkyReference } from './sky-reference';
import type { HouseConstruction } from './house-construction';
import { TRAIL_VERSION_KEY, type TrailResult, type BoundaryHistoryResult } from './trails';
import type { FeatureHit, FeatureKind } from './scene-hit';
import { BODY_IDENTITY } from './hover-card-themes';

export interface HoverParagraph {
  text: string;
  role: ContentClaim['role'];
  claimId: string;
}
export interface HoverSection {
  id: string;
  title: string;
  paragraphs: HoverParagraph[];
}
export interface HoverBody {
  id: BodyId;
  name: string;
  glyph: string;
  color: string;
  sign: { id: string; name: string; degree: number };
  claims: HoverParagraph[];
}
export interface HoverCardModel {
  id: string;
  entityId: string;
  kind: FeatureKind;
  title: string;
  kicker: string;
  glyph: { key: string; color: string };
  facts: { label: string; value: string }[];
  notices: string[];
  sections: HoverSection[];
  contentIds: string[];
  snapshotInstantMs: number | null;
  revision?: number;
  aspect?: { type: AspectTypeId; bodyA: HoverBody; bodyB: HoverBody };
}
export interface HoverLayerContext {
  enabled: boolean;
  available?: boolean;
  reason?: string;
}
export interface HoverCardContext {
  snapshot: EphemerisSnapshot | null;
  revision?: number;
  orbs?: OrbSettings;
  provisional?: boolean;
  pending?: boolean;
  trail?: TrailResult | null;
  history?: BoundaryHistoryResult | null;
  construction?: HouseConstruction | null;
  layers?: Record<string, HoverLayerContext>;
  references?: readonly SkyReference[];
  stars?: ReadonlyMap<number, CatalogueStar>;
  /** Never attach a requested civil label to a retained snapshot. */
  localTime?: { instantMs: number; label: string };
}
export const LAYER_HELP: Record<string, { title: string; claimIds: readonly string[] }> =
  Object.freeze({
    bodies: { title: 'Celestial bodies', claimIds: ['hover:bodies-layer'] },
    stars: { title: 'Catalogue stars', claimIds: ['hover:star'] },
    signs: { title: 'Tropical signs', claimIds: ['hover:sign-constellation'] },
    houses: { title: 'Longitude houses', claimIds: ['hover:houses-layer'] },
    horizon: { title: 'Local horizon', claimIds: ['reference:horizon'] },
    ecliptic: { title: 'Ecliptic', claimIds: ['reference:ecliptic'] },
    equator: { title: 'Celestial equator', claimIds: ['reference:equator'] },
    meridian: { title: 'Local meridian', claimIds: ['reference:meridian'] },
    primeVertical: { title: 'Prime vertical', claimIds: ['reference:prime-vertical'] },
    angles: { title: 'Chart angles', claimIds: ['angle:asc'] },
    constellations: { title: 'Constellation regions', claimIds: ['hover:constellation'] },
    asterisms: { title: 'Constellation asterisms', claimIds: ['hover:asterism'] },
    earthProjections: {
      title: 'Earth projections',
      claimIds: ['hover:earth-house', 'astro:overview'],
    },
    earthHouses: { title: 'Projected house sections', claimIds: ['hover:earth-house'] },
    astrocartography: { title: 'Astrocartography', claimIds: ['astro:overview'] },
    aspects: { title: 'Longitude aspects', claimIds: ['hover:aspects-layer'] },
    construction: { title: 'House construction guides', claimIds: ['construction:display-note:5'] },
    trails: { title: 'Body trails', claimIds: ['concept:trails'] },
    history: { title: 'Boundary history', claimIds: ['hover:history'] },
    ...Object.fromEntries(ASPECT_TYPES.map(type => [`aspect-type:${type.id}`, {
      title: type.name, claimIds: [`aspect-type:${type.id}`, 'hover:aspects-layer'],
    }])),
  });
const starsById = new Map(CATALOGUE_STARS.map((star) => [star[0], star]));
const cachedReferences = new WeakMap<EphemerisSnapshot, readonly SkyReference[]>();
const degree = (value: number) => `${normalizeDegrees(value).toFixed(2)}°`;
const signedDegree = (value: number) => `${value.toFixed(2)}°`;
const utc = (instant: number) =>
  new Date(instant).toISOString().replace('T', ' · ').replace('.000Z', ' UTC');
const systemName = (system: string | undefined) =>
  HOUSE_SYSTEMS.find((item) => item.id === system)?.name ?? system ?? 'House system';
const bodyId = (id: string) =>
  id.split(':').find((part) => BODY_IDS.includes(part as BodyId)) as BodyId | undefined;
function paragraphs(id: string, role?: ContentClaim['role']): HoverParagraph[] {
  const entry = getContent(id);
  if (entry)
    return entry.claims.flatMap((claim, index) =>
      !role || claim.role === role
        ? [
            {
              text: claim.text,
              role: claim.role,
              claimId: entry.existingClaimId ?? `${entry.id}:${index}`,
            },
          ]
        : [],
    );
  const supplemental = getProjectExplanation(id) ?? getSupplementalClaim(id);
  return supplemental && (!role || role === supplemental.role)
    ? [{ text: supplemental.text, role: supplemental.role, claimId: supplemental.id }]
    : [];
}
function section(id: string, title: string, role?: ContentClaim['role']): HoverSection {
  return { id, title, paragraphs: paragraphs(id, role) };
}
function housesFor(hit: FeatureHit, snapshot: EphemerisSnapshot): HouseResult | undefined {
  // The primary representation follows the current chart when its method changes.
  if (/^earth:(?:house|boundary):primary:/.test(hit.id)) return snapshot.houses[0];
  if (hit.representation==='comparison') return snapshot.houses[1];
  return hit.system
    ? snapshot.houses.find((item) => item.system === hit.system)
    : snapshot.houses[0];
}
function references(context: HoverCardContext) {
  if (context.references) return context.references;
  const snapshot = context.snapshot!;
  let value = cachedReferences.get(snapshot);
  if (!value) {
    value = getSkyReferences(snapshot);
    cachedReferences.set(snapshot, value);
  }
  return value;
}
function bodyModel(id: BodyId, longitude: number): HoverBody {
  const sign = zodiacSign(longitude);
  return {
    id,
    ...BODY_IDENTITY[id],
    sign: { id: sign.id, name: sign.name, degree: sign.degree },
    claims: paragraphs(`body-in-sign:${id}:${sign.id}`),
  };
}
function addPlacement(
  model: HoverCardModel,
  id: BodyId,
  context: HoverCardContext,
  hit: FeatureHit,
) {
  const sky = context.snapshot!,
    body = sky.bodies.find((item) => item.id === id);
  if (!body) return false;
  const sign = zodiacSign(body.longitudeDeg),
    houses = housesFor(hit, sky);
  model.facts.push({
    label: 'Tropical placement',
    value: `${sign.name} ${sign.degree.toFixed(2)}°`,
  });
  model.sections.push(
    section(`body:${id}`, 'Body meaning', 'tradition'),
    section(`body-in-sign:${id}:${sign.id}`, `${BODY_IDENTITY[id].name} in ${sign.name}`),
  );
  if (houses) {
    const membership = classifyLongitude(houses, body.longitudeDeg);
    if (membership.status === 'valid') {
      model.facts.push({ label: systemName(houses.system), value: `House ${membership.house}` });
      model.sections.push(
        section(
          `body-in-house:${id}:${membership.house}`,
          `${BODY_IDENTITY[id].name} in house ${membership.house}`,
        ),
      );
    } else model.notices.push(membership.reason);
  } else model.notices.push('No house calculation is available for this snapshot.');
  model.facts.push({
    label: 'Geometric horizon',
    value: `${signedDegree(body.horizon.altitudeDeg)} · ${body.horizon.altitudeDeg >= 0 ? 'above' : 'below'}`,
  });
  return true;
}
/** Read-only composition from committed geometry and registered claim records. No ephemeris request. */
export function resolveHoverCard(
  hit: FeatureHit,
  context: HoverCardContext,
): HoverCardModel | null {
  const sky = context.snapshot;
  if (!sky && hit.kind !== 'layer') return null;
  const model: HoverCardModel = {
    id: hit.id,
    entityId: hit.entityId,
    kind: hit.kind,
    title: hit.name,
    kicker: hit.kind.replace('-', ' '),
    glyph: { key: hit.kind, color: '#c4d4df' },
    facts: [],
    notices: [],
    sections: [],
    contentIds: [],
    snapshotInstantMs: sky?.instantMs ?? null,
    ...(context.revision !== undefined ? { revision: context.revision } : {}),
  };
  if (context.pending) model.notices.push('Previous calculated snapshot · update pending');
  if (context.provisional) model.notices.push('Provisional birth time');
  if (hit.representation === 'comparison')
    model.notices.push(`Comparison · ${systemName(sky?.houses[1]?.system ?? hit.system)}`);
  if (hit.role) model.facts.push({ label: 'Feature role', value: hit.role });
  const id = hit.entityId;
  switch (hit.kind) {
    case 'body': {
      const body = bodyId(id);
      if (!body || !addPlacement(model, body, context, hit)) return null;
      model.title = BODY_IDENTITY[body].name;
      model.kicker = 'Celestial body';
      model.glyph = { key: body, color: BODY_IDENTITY[body].color };
      break;
    }
    case 'aspect': {
      const aspect = getAspectDetails(sky!.bodies, id, context.orbs ?? DEFAULT_ORBS);
      if (!aspect || !aspect.withinOrb) return null;
      const a = bodyModel(aspect.bodyA, aspect.longitudeADeg),
        b = bodyModel(aspect.bodyB, aspect.longitudeBDeg);
      model.aspect = { type: aspect.type, bodyA: a, bodyB: b };
      model.title = `${a.name} · ${b.name}`;
      model.kicker = aspect.type;
      model.glyph.key = aspect.type;
      model.sections.push(
        section(`aspect-type:${aspect.type}`, 'Traditional interpretation', 'tradition'),
        {
          id: `body-in-sign:${a.id}:${a.sign.id}`,
          title: `${a.name} in ${a.sign.name}`,
          paragraphs: a.claims,
        },
        {
          id: `body-in-sign:${b.id}:${b.sign.id}`,
          title: `${b.name} in ${b.sign.name}`,
          paragraphs: b.claims,
        },
      );
      model.facts.push(
        { label: 'Longitude separation', value: degree(aspect.separationDeg) },
        { label: 'Target', value: degree(aspect.targetDeg) },
        { label: 'Departure', value: degree(aspect.departureDeg) },
        { label: 'Configured orb', value: degree(aspect.orbDeg) },
      );
      if (aspect.actualSkySeparationDeg !== undefined)
        model.facts.push({
          label: 'Actual sky angle',
          value: degree(aspect.actualSkySeparationDeg),
        });
      break;
    }
    case 'sign': {
      const entry = getContent(id);
      if (!entry || entry.kind !== 'sign') return null;
      model.title = entry.title;
      model.kicker = 'Tropical sign';
      model.glyph.key = entry.signId!;
      model.sections.push(
        section(id, 'Traditional interpretation', 'tradition'),
        section('hover:sign-constellation', 'In the sky'),
      );
      model.facts.push({
        label: 'Longitude interval',
        value: `${entry.startLongitudeDeg}° ≤ λ < ${entry.endLongitudeDeg}°`,
      });
      break;
    }
    case 'house':
    case 'boundary':
    case 'earth-house': {
      const number = Number(id.match(/(\d+)$/)?.[1]);
      if (!Number.isInteger(number) || number < 1 || number > 12) return null;
      const houses = housesFor(hit, sky!);
      if (!houses) return null;
      const isBoundary = hit.kind === 'boundary' || hit.id.includes(':boundary:');
      model.title = `${isBoundary ? 'Cusp' : 'House'} ${number}`;
      model.kicker =
        hit.kind === 'earth-house'
          ? `Projected chart ${isBoundary ? 'boundary' : 'house'}`
          : `${systemName(houses.system)} · ${isBoundary ? 'boundary' : 'house'}`;
      model.glyph.key = 'house';
      model.sections.push(section(`house:${number}`, 'Traditional interpretation'));
      model.facts.push({ label: 'System', value: systemName(houses.system) });
      if (hit.kind === 'earth-house') {
        model.sections.unshift(section('hover:earth-house', 'Projection meaning'));
        model.facts.push({
          label: 'Observer',
          value: `${sky!.observer.latitudeDeg.toFixed(3)}°, ${sky!.observer.longitudeDeg.toFixed(3)}°`,
        });
      }
      if (houses.status === 'undefined') model.notices.push(houses.reason);
      else {
        const partition = housePartition(houses);
        if (partition.status === 'undefined') model.notices.push(partition.reason);
        else {
          const interval = partition.intervals[number - 1]!;
          model.facts.push(
            { label: 'Indexed cusp', value: degree(interval.startDeg) },
            {
              label: 'Directed interval',
              value: `${degree(interval.startDeg)} → ${degree(interval.endDeg)} · ${interval.direction === 1 ? 'increasing' : 'decreasing'} λ`,
            },
          );
        }
      }
      if (isBoundary)
        model.sections.push(
          section(
            'hover:house-boundary',
            `Between houses ${number === 1 ? 12 : number - 1} and ${number}`,
          ),
        );
      break;
    }
    case 'angle':
    case 'reference': {
      if (id === 'reference:earth' || id === 'reference:observer') {
        model.title = id.endsWith('earth') ? 'Earth' : 'Observer';
        model.glyph.key = id.endsWith('earth') ? 'earth' : 'observer';
        model.sections.push(
          section(id.endsWith('earth') ? 'hover:earth' : 'hover:observer', 'Geographic context'),
        );
        model.facts.push(
          { label: 'Latitude', value: signedDegree(sky!.observer.latitudeDeg) },
          { label: 'Longitude · east', value: signedDegree(sky!.observer.longitudeDeg) },
        );
        if (context.localTime?.instantMs === sky!.instantMs)
          model.facts.push({ label: 'Local moment', value: context.localTime.label });
      } else if (/(?:compass|cardinal|north|east|south|west)(?::|$)/.test(hit.id) && !getContent(hit.id)) {
        model.title = hit.name;
        model.sections.push(section('hover:compass', 'Local directions'));
      } else {
        const reference = references(context).find((item) => item.id === id);
        if (!reference) return null;
        model.title = reference.name;
        model.sections.push(
          section(id, hit.kind === 'angle' ? 'Geometric definition' : 'Reference geometry'),
        );
        if (reference.status === 'undefined')
          model.notices.push(reference.reason ?? 'Undefined at this location');
        if (reference.longitudeDeg !== undefined) {
          const sign = zodiacSign(reference.longitudeDeg);
          model.facts.push({
            label: 'Tropical placement',
            value: `${sign.name} ${sign.degree.toFixed(2)}°`,
          });
        }
        if (hit.kind === 'angle') {
          const angle = id.split(':')[1]!.replace('asc', 'ac').replace('dsc', 'dc');
          model.sections.push(section(`astro:angle:${angle}`, 'Traditional angle theme'));
        }
      }
      break;
    }
    case 'constellation':
    case 'asterism': {
      const abbreviation = id.split(':').at(-1)!,
        region = CONSTELLATIONS.find((item) => item.id === `constellation:${abbreviation}`);
      if (!region) return null;
      model.title = region.name;
      model.kicker =
        hit.kind === 'asterism' ? 'Constellation asterism' : 'Official constellation region';
      model.facts.push({ label: 'Abbreviation', value: region.abbreviation });
      model.sections.push(
        section(
          hit.kind === 'asterism' ? 'hover:asterism' : 'hover:constellation',
          'What this represents',
        ),
      );
      break;
    }
    case 'star': {
      const number = Number(id.match(/(\d+)$/)?.[1]),
        star = context.stars?.get(number) ?? starsById.get(number);
      if (!star) return null;
      model.title = star[1] || `HYG ${star[0]}`;
      model.kicker = 'Catalogue star';
      model.facts.push(
        { label: 'Catalogue identity', value: `HYG ${star[0]}` },
        { label: 'Visual magnitude', value: star[2].toFixed(2) },
      );
      const position=vectorToEquatorial(catalogueStarDirection(star,sky!.time.julianDateTt));
      model.facts.push(
        {label:'Fixed J2000 RA',value:degree(position.rightAscensionDeg)},
        {label:'Fixed J2000 declination',value:signedDegree(position.declinationDeg)},
        {label:'Position epoch',value:utc(sky!.instantMs)},
      );
      model.sections.push(section('hover:star', 'Catalogue position'));
      break;
    }
    case 'construction': {
      const guide = context.construction;
      if (!guide || (hit.system && hit.system !== guide.system)) return null;
      const key = hit.constructionId ?? hit.id,
        element = [...guide.lines, ...guide.markers].find((item) => item.id === key),
        stage = element?.stage ?? Math.min(2, Math.max(0, Number(hit.role?.match(/\d/)?.[0]) || 0));
      if (hit.constructionId && !element) return null;
      model.title = element?.label ?? hit.name;
      model.kicker = `${systemName(guide.system)} · construction`;
      model.facts.push(
        { label: 'Boundary', value: `C${guide.house}` },
        { label: 'Stage', value: `${stage + 1} · ${guide.steps[stage]?.title ?? 'Guide'}` },
      );
      model.sections.push(section(`construction:${guide.system}:${stage}`, 'Construction rule'));
      if (guide.status !== 'valid') model.notices.push(guide.notes[0] ?? guide.status);
      if (guide.nativeCuspDeg !== null)
        model.facts.push({ label: 'Final cusp', value: degree(guide.nativeCuspDeg) });
      break;
    }
    case 'trail': {
      const body = bodyId(id);
      if (!body) return null;
      model.title = `${BODY_IDENTITY[body].name} trail`;
      model.glyph = { key: body, color: BODY_IDENTITY[body].color };
      model.sections.push(
        section('concept:trails', 'Reference frame'),
        section(`body:${body}`, 'Traditional body meaning', 'tradition'),
      );
      const result = context.trail;
      if (
        !result ||
        result.bodyId !== body ||
        result.versionKey !== TRAIL_VERSION_KEY ||
        result.observer.latitudeDeg !== sky!.observer.latitudeDeg ||
        result.observer.longitudeDeg !== sky!.observer.longitudeDeg ||
        (hit.frame && hit.frame !== result.frame)
      )
        return null;
      if (
        hit.sampleInstantMs !== undefined &&
        !result.samples.some((item) => item.instantMs === hit.sampleInstantMs) &&
        hit.sampleInstantMs !== sky!.instantMs
      )
        return null;
      if (
        hit.sampleEndInstantMs !== undefined &&
        (hit.sampleInstantMs === undefined ||
          hit.sampleEndInstantMs < hit.sampleInstantMs ||
          (!result.samples.some((item) => item.instantMs === hit.sampleEndInstantMs) &&
            hit.sampleEndInstantMs !== sky!.instantMs))
      )
        return null;
      model.facts.push({
        label: 'Frame',
        value: result.frame === 'horizon' ? 'Relative to horizon' : 'Relative to stars',
      });
      if (hit.sampleInstantMs !== undefined) {
        model.facts.push(
          {
            label: hit.sampleEndInstantMs !== undefined ? 'Segment begins' : 'Sample time',
            value: utc(hit.sampleInstantMs),
          },
          {
            label: 'Relative to displayed moment',
            value:
              hit.sampleEndInstantMs !== undefined && hit.sampleInstantMs <= sky!.instantMs && hit.sampleEndInstantMs >= sky!.instantMs
                ? 'Spans displayed moment'
                : (hit.sampleEndInstantMs ?? hit.sampleInstantMs) < sky!.instantMs
                ? 'Past'
                : hit.sampleInstantMs > sky!.instantMs
                  ? 'Future'
                  : 'Current',
          },
        );
        if (hit.sampleEndInstantMs !== undefined) {
          model.facts.push({ label: 'Segment ends', value: utc(hit.sampleEndInstantMs) });
          model.sections.push(section('hover:trail-segment', 'Sample interval'));
        } else {
          const sample = result?.samples.find((item) => item.instantMs === hit.sampleInstantMs);
          if (sample)
            model.facts.push({
              label: 'Sample altitude',
              value: signedDegree(
                (Math.atan2(sample.enu.up, Math.hypot(sample.enu.east, sample.enu.north)) * 180) /
                  Math.PI,
              ),
            });
          else if (hit.sampleInstantMs === sky!.instantMs) {
            const currentBody = sky!.bodies.find((item) => item.id === body);
            if (currentBody)
              model.facts.push({
                label: 'Sample altitude',
                value: signedDegree(currentBody.horizon.altitudeDeg),
              });
          }
        }
      }
      break;
    }
    case 'history': {
      const result = context.history;
      const indexedHouse = Number(
        hit.entityId.match(/(?:boundary|history):(?:[A-Z]:)?(\d+)$/)?.[1],
      );
      if (
        !result ||
        result.versionKey !== TRAIL_VERSION_KEY ||
        result.observer.latitudeDeg !== sky!.observer.latitudeDeg ||
        result.observer.longitudeDeg !== sky!.observer.longitudeDeg ||
        (hit.system && hit.system !== result.system) ||
        (Number.isInteger(indexedHouse) && indexedHouse !== result.house)
      )
        return null;
      const sample = result.samples.find((item) => item.instantMs === hit.sampleInstantMs);
      if (hit.sampleInstantMs !== undefined && !sample) return null;
      model.title = `Cusp ${result.house} history`;
      model.kicker = `${systemName(result.system)} · historical boundary`;
      model.sections.push(section('hover:history', 'Boundary sampling'));
      model.facts.push({ label: 'System', value: systemName(result.system) });
      if (sample) {
        model.facts.push(
          { label: 'Sample time', value: utc(sample.instantMs) },
          { label: 'Sample state', value: sample.status },
        );
        if (sample.status === 'undefined') model.notices.push(sample.reason);
        else {
          model.facts.push({ label: 'Historical cusp', value: degree(sample.longitudeDeg) });
          if (sample.reason) model.notices.push(sample.reason);
        }
      }
      break;
    }
    case 'astro-line': {
      const match = /^astro:([a-z]+):(ac|dc|mc|ic)$/.exec(id),
        body = match?.[1] as BodyId | undefined,
        angle = match?.[2];
      if (!body || !BODY_IDS.includes(body) || !angle) return null;
      model.title = `${BODY_IDENTITY[body].name} · ${angle.toUpperCase()}`;
      model.kicker = 'Astrocartography line';
      model.glyph = { key: body, color: BODY_IDENTITY[body].color };
      model.sections.push(
        section('astro:overview', 'Geometric context'),
        section(`astro:body:${body}`, 'Traditional body theme'),
        section(`astro:angle:${angle}`, 'Traditional angle theme'),
      );
      model.facts.push({
        label: 'Angular condition',
        value: {
          ac: 'Rising across the geometric horizon',
          dc: 'Setting across the geometric horizon',
          mc: 'Upper meridian transit',
          ic: 'Lower meridian transit',
        }[angle]!,
      });
      break;
    }
    case 'layer': {
      const key = id.replace(/^layer:/, ''),
        help = LAYER_HELP[key];
      if (!help) return null;
      model.title = help.title;
      model.kicker = 'Layer guide';
      model.sections.push(...help.claimIds.map((claim) => section(claim, 'Layer purpose')));
      const state = context.layers?.[key];
      if (state) {
        model.facts.push({ label: 'Display', value: state.enabled ? 'Enabled' : 'Disabled' });
        if (state.available === false)
          model.notices.push(state.reason ?? 'Unavailable in this snapshot');
      }
      break;
    }
  }
  model.sections = model.sections.filter((item) => item.paragraphs.length > 0);
  model.contentIds = [
    ...new Set(model.sections.map((item) => item.id).filter((id) => getContent(id))),
  ];
  if (sky && !['star', 'constellation', 'asterism', 'layer'].includes(hit.kind))
    model.facts.push({ label: 'Displayed moment', value: utc(sky.instantMs) });
  return model;
}

/** Explicit illustrative fixtures, separate from every calculated chart. */
export function aspectPreviewModel(type: AspectTypeId = 'square'): HoverCardModel {
  const longitude = { conjunction: 5, sextile: 65, square: 275, trine: 125, opposition: 185 }[type],
    a = bodyModel('venus', 5),
    b = bodyModel('neptune', longitude);
  return {
    id: `preview:${type}`,
    entityId: `preview:${type}`,
    kind: 'aspect',
    title: 'Venus · Neptune',
    kicker: type,
    glyph: { key: type, color: '#dfad89' },
    snapshotInstantMs: null,
    contentIds: [
      `aspect-type:${type}`,
      `body-in-sign:${a.id}:${a.sign.id}`,
      `body-in-sign:${b.id}:${b.sign.id}`,
    ],
    facts: [
      {
        label: 'Target',
        value: `${{ conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 }[type]}°`,
      },
      { label: 'Configured orb', value: '6.00°' },
      { label: 'Departure', value: '0.00°' },
    ],
    notices: ['Design fixture · illustrative placements'],
    sections: [
      section(`aspect-type:${type}`, 'Traditional interpretation', 'tradition'),
      {
        id: `body-in-sign:${a.id}:${a.sign.id}`,
        title: `${a.name} in ${a.sign.name}`,
        paragraphs: a.claims,
      },
      {
        id: `body-in-sign:${b.id}:${b.sign.id}`,
        title: `${b.name} in ${b.sign.name}`,
        paragraphs: b.claims,
      },
    ],
    aspect: { type, bodyA: a, bodyB: b },
  };
}
