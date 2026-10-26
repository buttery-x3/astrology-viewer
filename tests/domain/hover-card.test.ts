import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  BODY_IDS,
  EPHEMERIS_FILES,
  EphemerisEngine,
  HOUSE_SYSTEMS,
  type EphemerisSnapshot,
  type HouseResult,
} from '../../src/lib/astronomy/ephemeris';
import { getContent, CONTENT_CATALOGUE } from '../../src/lib/content';
import supplemental from '../../src/lib/content/data/supplemental-claims.json';
import { ASPECT_TYPES, SIGNS } from '../../src/lib/domain/chart';
import {
  aspectPreviewModel,
  LAYER_HELP,
  resolveHoverCard,
  type HoverCardContext,
  type HoverCardModel,
} from '../../src/lib/domain/hover-card';
import {
  ASPECT_CARD_THEMES,
  BODY_IDENTITY,
  cardSparkles,
} from '../../src/lib/domain/hover-card-themes';
import { featureHit, type FeatureHit } from '../../src/lib/domain/scene-hit';
import {
  buildHouseConstruction,
  DEFAULT_CONSTRUCTION,
} from '../../src/lib/domain/house-construction';
import {
  makeTrailSample,
  TRAIL_VERSION_KEY,
  type BoundaryHistoryResult,
  type TrailResult,
} from '../../src/lib/domain/trails';
import { CATALOGUE_STARS, CONSTELLATIONS, type CatalogueStar } from '../../src/lib/scene/sky-data';
import { getSkyReferences } from '../../src/lib/domain/sky-reference';

let engine: EphemerisEngine, snapshot: EphemerisSnapshot;
const ZODIAC_SIGNS = SIGNS.map((name) => ({ name, id: name.toLowerCase() }));
beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(
      await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm'),
    ),
    files: new Map(
      await Promise.all(
        EPHEMERIS_FILES.map(
          async (file) =>
            [
              file.name,
              new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`)),
            ] as const,
        ),
      ),
    ),
  });
  snapshot = engine.calculate(Date.UTC(1987, 3, 26, 16), {
    latitudeDeg: -37.814,
    longitudeDeg: 144.96332,
  });
});
afterAll(() => engine?.close());
function card(hit: FeatureHit, context: Partial<HoverCardContext> = {}): HoverCardModel {
  const result = resolveHoverCard(hit, { snapshot, ...context });
  expect(result).not.toBeNull();
  return result!;
}
function equalHouses(reverse = false): Extract<HouseResult, { status: 'valid' }> {
  return {
    system: 'E',
    status: 'valid',
    cusps: Array.from({ length: 12 }, (_, index) => (360 + (reverse ? -1 : 1) * index * 30) % 360),
    ascendantDeg: 0,
    midheavenDeg: 270,
    armcDeg: 270,
  };
}
function withLongitude(
  id: (typeof BODY_IDS)[number],
  longitudeDeg: number,
  latitudeDeg = 0,
): EphemerisSnapshot {
  return {
    ...snapshot,
    bodies: snapshot.bodies.map((body) =>
      body.id === id ? { ...body, longitudeDeg, latitudeDeg } : body,
    ),
  };
}
function facts(model: HoverCardModel) {
  return Object.fromEntries(model.facts.map((fact) => [fact.label, fact.value]));
}
function trail(): TrailResult {
  const past = engine.calculate(snapshot.instantMs - 3600000, snapshot.observer),
    future = engine.calculate(snapshot.instantMs + 3600000, snapshot.observer);
  return {
    jobId: 1,
    bodyId: 'venus',
    frame: 'stars',
    observer: { ...snapshot.observer },
    anchorMs: snapshot.instantMs,
    requestedStartMs: past.instantMs,
    requestedEndMs: future.instantMs,
    startMs: past.instantMs,
    endMs: future.instantMs,
    samples: [past, snapshot, future].map((sky) => makeTrailSample(sky, 'venus')),
    status: 'complete',
    progress: 1,
    limits: [],
    versionKey: TRAIL_VERSION_KEY,
  };
}
function history(): BoundaryHistoryResult {
  return {
    jobId: 1,
    system: 'W',
    house: 1,
    observer: { ...snapshot.observer },
    anchorMs: snapshot.instantMs,
    requestedStartMs: snapshot.instantMs - 3600000,
    requestedEndMs: snapshot.instantMs,
    startMs: snapshot.instantMs - 3600000,
    endMs: snapshot.instantMs,
    samples: [
      {
        instantMs: snapshot.instantMs - 3600000,
        status: 'undefined',
        reason: 'Unavailable polar sample.',
      },
      {
        instantMs: snapshot.instantMs,
        status: 'jump',
        longitudeDeg: 30,
        direction: 1,
        point: { x: 1, y: 0, z: 0 },
        line: [],
        reason: 'Whole Sign rising-sign transition; no continuous motion.',
      },
    ],
    limits: [],
    status: 'complete',
    progress: 1,
    versionKey: TRAIL_VERSION_KEY,
  };
}
const registeredTexts = new Set([
  ...CONTENT_CATALOGUE.flatMap((entry) => entry.claims.map((claim) => claim.text)),
  ...supplemental.map((claim) => claim.text),
]);
function expectRegistered(model: HoverCardModel) {
  expect(model.sections.length).toBeGreaterThan(0);
  for (const section of model.sections)
    for (const paragraph of section.paragraphs) {
      expect(registeredTexts.has(paragraph.text), paragraph.text).toBe(true);
      expect(paragraph.claimId).toBeTruthy();
    }
  expect(new Set(model.contentIds).size).toBe(model.contentIds.length);
  for (const id of model.contentIds) expect(getContent(id)).toBeDefined();
}

describe('registered placements and single aspect composition', () => {
  it('uses the exact Melbourne birth example: actual Sun in Taurus', () => {
    const model = card(featureHit('body:sun'));
    expect(facts(model)['Tropical placement']).toMatch(/^Taurus /);
    expect(model.contentIds).toContain('body-in-sign:sun:taurus');
    expectRegistered(model);
  });
  for (const id of BODY_IDS)
    for (const [index, sign] of ZODIAC_SIGNS.entries()) {
      it(`resolves ${id} in ${sign.name} and house ${index + 1} from the committed longitude`, () => {
        const sky = { ...withLongitude(id, index * 30 + 5), houses: [equalHouses()] };
        const model = card(featureHit(`body:${id}`), { snapshot: sky });
        expect(model.contentIds).toContain(`body-in-sign:${id}:${sign.id}`);
        expect(model.contentIds).toContain(`body-in-house:${id}:${index + 1}`);
        expect(facts(model).Equal).toBe(`House ${index + 1}`);
        expectRegistered(model);
      });
    }
  for (const aspect of ASPECT_TYPES) {
    it(`combines ${aspect.id}, Venus and Neptune in exactly one card`, () => {
      let sky = withLongitude('venus', 5, 5);
      sky = {
        ...sky,
        bodies: sky.bodies.map((body) =>
          body.id === 'neptune'
            ? { ...body, longitudeDeg: (5 + aspect.angleDeg) % 360, latitudeDeg: -6 }
            : body,
        ),
      };
      const model = card(featureHit(`aspect:venus-neptune:${aspect.id}`), { snapshot: sky });
      expect(model.aspect?.type).toBe(aspect.id);
      expect(model.sections).toHaveLength(3);
      expect(model.sections.map((section) => section.id)).toEqual([
        `aspect-type:${aspect.id}`,
        'body-in-sign:venus:aries',
        `body-in-sign:neptune:${model.aspect!.bodyB.sign.id}`,
      ]);
      expect(model.aspect?.bodyA.name).toBe('Venus');
      expect(model.aspect?.bodyB.name).toBe('Neptune');
      expect(facts(model)).toHaveProperty('Actual sky angle');
      expectRegistered(model);
    });
  }
  it('uses actual Capricorn interpretation and distinguishes longitude from sky separation', () => {
    let sky = withLongitude('venus', 5, 20);
    sky = {
      ...sky,
      bodies: sky.bodies.map((body) =>
        body.id === 'neptune' ? { ...body, longitudeDeg: 275, latitudeDeg: 20 } : body,
      ),
    };
    const model = card(featureHit('aspect:venus-neptune:square'), { snapshot: sky });
    expect(model.contentIds).toContain('body-in-sign:neptune:capricorn');
    expect(facts(model)['Longitude separation']).toBe('90.00°');
    expect(facts(model)['Actual sky angle']).not.toBe('90.00°');
    const exited = {
      ...sky,
      bodies: sky.bodies.map((body) =>
        body.id === 'neptune' ? { ...body, longitudeDeg: 290 } : body,
      ),
    };
    expect(
      resolveHoverCard(featureHit('aspect:venus-neptune:square'), { snapshot: exited }),
    ).toBeNull();
    expect(
      resolveHoverCard(featureHit('aspect:neptune-venus:square'), { snapshot: sky }),
    ).toBeNull();
  });
  it('retains snapshot identity while pending and never attaches the requested civil label', () => {
    const before = structuredClone(snapshot);
    const model = card(featureHit('body:sun'), {
      pending: true,
      provisional: true,
      revision: 7,
      localTime: { instantMs: snapshot.instantMs + 1, label: 'WRONG REQUESTED TIME' },
    });
    expect(model.snapshotInstantMs).toBe(snapshot.instantMs);
    expect(model.revision).toBe(7);
    expect(model.notices).toContain('Previous calculated snapshot · update pending');
    expect(JSON.stringify(model)).not.toContain('WRONG REQUESTED TIME');
    expect(snapshot).toEqual(before);
    expect(resolveHoverCard(featureHit('body:sun'), { snapshot: null })).toBeNull();
  });
});

describe('geometric identity, comparisons and historical representations', () => {
  it('keeps a projected primary selection on the new primary system rather than its old comparison', () => {
    const oldPrimary=engine.calculate(snapshot.instantMs,snapshot.observer,['W']).houses[0]!;
    const newPrimary=engine.calculate(snapshot.instantMs,snapshot.observer,['P']).houses[0]!;
    const hit=featureHit('earth:house:primary:7','Projected house 7',{kind:'earth-house',representation:'earth',system:'W'});
    for(const houses of [[newPrimary],[newPrimary,oldPrimary]]) {
      const model=card(hit,{snapshot:{...snapshot,houses}});
      expect(model.entityId).toBe('earth:house:primary:7');
      expect(facts(model).System).toBe('Placidus');
      if(newPrimary.status==='valid')expect(facts(model)['Indexed cusp']).toBe(`${newPrimary.cusps[6]!.toFixed(2)}°`);
    }
  });
  for (const sign of ZODIAC_SIGNS)
    it(`identifies tropical ${sign.name} independently of constellation regions`, () => {
      const model = card(featureHit(`sign:${sign.id}`));
      expect(model.kicker).toBe('Tropical sign');
      expect(model.sections.map((section) => section.id)).toContain('hover:sign-constellation');
      expectRegistered(model);
    });
  it('preserves comparison alias, exact selected system and reverse polar intervals', () => {
    const sky = {
      ...snapshot,
      houses: [snapshot.houses.find((house) => house.system === 'W')!, equalHouses(true)],
    };
    const model = card(
      featureHit('house:comparison:7', 'Compared house', {
        entityId: 'house:7',
        representation: 'comparison',
        system: 'E',
      }),
      { snapshot: sky },
    );
    expect(model.id).toBe('house:comparison:7');
    expect(model.entityId).toBe('house:7');
    expect(facts(model).System).toBe('Equal');
    expect(facts(model)['Directed interval']).toContain('decreasing');
    expect(model.notices).toContain('Comparison · Equal');
    expectRegistered(model);
    const projected = card(
      featureHit('earth:boundary:primary:7', 'Projected cusp', {
        entityId: 'boundary:7',
        kind: 'earth-house',
        representation: 'earth',
        system: 'E',
      }),
      { snapshot: sky },
    );
    expect(projected.title).toBe('Cusp 7');
    expect(projected.kicker).toBe('Projected chart boundary');
    expect(projected.sections.map((section) => section.id)).toContain('hover:house-boundary');
    expectRegistered(projected);
  });
  it('rebinds a stable comparison cusp to the current secondary slot after a method change', () => {
    const sky=engine.calculate(snapshot.instantMs,snapshot.observer,['E','P']);
    const hit=featureHit('boundary:comparison:7','Comparison cusp 7',{representation:'comparison',system:'E'});
    const model=card(hit,{snapshot:sky});
    expect(facts(model).System).toBe('Placidus');
    expect(model.notices).toContain('Comparison · Placidus');
    const current=sky.houses[1]!;
    if(current.status==='valid')expect(facts(model)['Indexed cusp']).toBe(`${current.cusps[6]!.toFixed(2)}°`);
    expect(resolveHoverCard(hit,{snapshot:{...sky,houses:[sky.houses[0]!]}})).toBeNull();
  });
  it('discloses undefined houses instead of inventing a body-in-house placement', () => {
    const sky = {
      ...snapshot,
      houses: [
        {
          system: 'P',
          status: 'undefined',
          reason: 'Placidus is undefined at this latitude.',
        } as const,
      ],
    };
    const model = card(featureHit('body:moon'), { snapshot: sky });
    expect(model.notices).toContain('Placidus is undefined at this latitude.');
    expect(model.contentIds.some((id) => id.startsWith('body-in-house:'))).toBe(false);
    expectRegistered(model);
  });
  it('keeps canonical geometric angles and all nine spatial reference claims', () => {
    for (const reference of getSkyReferences(snapshot)) {
      const model = card(
        featureHit(reference.id, reference.name, {
          kind: reference.id.startsWith('angle:') ? 'angle' : 'reference',
        }),
      );
      expect(model.title).toBe(reference.name);
      expect(model.contentIds).toContain(reference.id);
      expectRegistered(model);
    }
    const pole = engine.calculate(snapshot.instantMs, { latitudeDeg: 90, longitudeDeg: 0 });
    expect(card(featureHit('angle:asc'), { snapshot: pole }).notices.join(' ')).toMatch(/pole/i);
    const observer = card(featureHit('reference:observer'), {
      localTime: { instantMs: snapshot.instantMs, label: '1987-04-27 02:00 Australia/Melbourne' },
    });
    expect(facts(observer)['Local moment']).toContain('1987-04-27');
    expectRegistered(observer);
    expectRegistered(card(featureHit('reference:earth')));
    expectRegistered(card(featureHit('reference:compass:east')));
  });
  it('identifies all 88 regions, figure conventions and catalogue stars', () => {
    for (const region of CONSTELLATIONS) {
      expectRegistered(card(featureHit(region.id, region.name, { kind: 'constellation' })));
      expectRegistered(
        card(
          featureHit(`asterism:${region.abbreviation.toLowerCase()}`, region.name, {
            kind: 'asterism',
          }),
        ),
      );
    }
    const star = CATALOGUE_STARS[0]!;
    expectRegistered(card(featureHit(`star:${star[0]}`)));
    const extra: CatalogueStar = [987654, 'Support star', 4, 1, 0, 0, 0, 0, 0, null];
    const support = card(featureHit('star:987654'), { stars: new Map([[extra[0], extra]]) });
    expect(support.title).toBe('Support star');
    expectRegistered(support);
  });
  it('uses existing stage claims for all seven construction methods', () => {
    for (const { id: system } of HOUSE_SYSTEMS) {
      const guide = buildHouseConstruction(
        snapshot,
        snapshot.houses.find((house) => house.system === system)!,
        { ...DEFAULT_CONSTRUCTION, enabled: true, boundaryHouse: 11 },
      );
      for (let stage = 0; stage < 3; stage++) {
        const element = [...guide.lines, ...guide.markers].find((item) => item.stage === stage)!;
        expect(element).toBeDefined();
        const model = card(
          featureHit(`construction:${system}:${stage}`, 'Guide geometry', {
            constructionId: element.id,
            kind: 'construction',
          }),
          { construction: guide },
        );
        expect(model.sections[0]?.id).toBe(`construction:${system}:${stage}`);
        expectRegistered(model);
      }
    }
  });
  it('labels trail samples/segments with historical facts without current placement prose', () => {
    const result = trail(),
      sample = result.samples[0]!;
    const model = card(
      featureHit('trail:venus:sample', 'Past Venus', {
        entityId: 'trail:venus',
        kind: 'trail',
        sampleInstantMs: sample.instantMs,
        frame: 'stars',
      }),
      { trail: result },
    );
    expect(facts(model)['Relative to displayed moment']).toBe('Past');
    expect(facts(model)).toHaveProperty('Sample altitude');
    expect(model.contentIds.some((id) => id.startsWith('body-in-'))).toBe(false);
    expectRegistered(model);
    const segment = card(
      featureHit('trail:venus:segment', 'Venus segment', {
        entityId: 'trail:venus',
        kind: 'trail',
        sampleInstantMs: sample.instantMs,
        sampleEndInstantMs: result.samples[1]!.instantMs,
        frame: 'stars',
      }),
      { trail: result },
    );
    expect(facts(segment)).toHaveProperty('Segment begins');
    expect(facts(segment)).toHaveProperty('Segment ends');
    expect(facts(segment)['Relative to displayed moment']).toBe('Spans displayed moment');
    expectRegistered(segment);
    expect(
      resolveHoverCard(
        featureHit('trail:venus', 'Trail', { sampleInstantMs: sample.instantMs + 1 }),
        { snapshot, trail: result },
      ),
    ).toBeNull();
    expect(
      resolveHoverCard(featureHit('trail:venus', 'Trail', { frame: 'horizon' }), {
        snapshot,
        trail: result,
      }),
    ).toBeNull();
    expect(
      resolveHoverCard(featureHit('trail:venus'), {
        snapshot,
        trail: { ...result, observer: { latitudeDeg: 0, longitudeDeg: 0 } },
      }),
    ).toBeNull();
  });
  it('retains undefined/jump history and rejects stale system/location/version', () => {
    const result = history();
    for (const sample of result.samples) {
      const model = card(
        featureHit(`history:W:1:${sample.instantMs}`, 'Ghost', {
          entityId: 'history:W:1',
          kind: 'history',
          sampleInstantMs: sample.instantMs,
          system: 'W',
        }),
        { history: result },
      );
      expect(facts(model)['Sample state']).toBe(sample.status);
      expect(facts(model).Frame).toBe('Relative to stars');
      expect(facts(model)['Relative to displayed moment']).toBe(sample.instantMs<snapshot.instantMs?'Past':sample.instantMs>snapshot.instantMs?'Future':'Current');
      expectRegistered(model);
      if (sample.status === 'undefined') {
        expect(facts(model)).not.toHaveProperty('Historical cusp');
        expect(model.notices).toContain(sample.reason);
      } else expect(facts(model)['Historical cusp']).toBe('30.00°');
    }
    expect(
      resolveHoverCard(featureHit('history:W:1', 'Ghost', { system: 'P' }), {
        snapshot,
        history: result,
      }),
    ).toBeNull();
    expect(resolveHoverCard(featureHit('history:W:1','Ghost',{frame:'horizon'}),{snapshot,history:result})).toBeNull();
    expect(
      resolveHoverCard(featureHit('history:W:1'), {
        snapshot,
        history: { ...result, versionKey: 'old' },
      }),
    ).toBeNull();
    expect(
      resolveHoverCard(
        featureHit('history:W:2', 'Wrong indexed ghost', { entityId: 'boundary:2' }),
        { snapshot, history: result },
      ),
    ).toBeNull();
  });
  for (const body of BODY_IDS)
    for (const angle of ['ac', 'dc', 'mc', 'ic'])
      it(`combines ${body}/${angle} astrocartography geometry and attributed themes`, () => {
        const model = card(featureHit(`astro:${body}:${angle}`));
        expect(model.contentIds).toEqual([
          'astro:overview',
          `astro:body:${body}`,
          `astro:angle:${angle}`,
        ]);
        expect(facts(model)).toHaveProperty('Angular condition');
        expectRegistered(model);
      });
  for (const [key, help] of Object.entries(LAYER_HELP))
    it(`explains the ${key} layer without requiring a chart`, () => {
      const model = card(featureHit(`layer:${key}`), {
        snapshot: null,
        layers: {
          [key]: { enabled: false, available: false, reason: 'Not available in this view.' },
        },
      });
      expect(model.title).toBe(help.title);
      expect(facts(model).Display).toBe('Disabled');
      expect(model.notices).toContain('Not available in this view.');
      expectRegistered(model);
    });
});

describe('five reusable visual themes', () => {
  it('covers five unique palettes and ten consistent body identities', () => {
    expect(Object.keys(ASPECT_CARD_THEMES)).toEqual(ASPECT_TYPES.map((type) => type.id));
    expect(
      new Set(
        Object.values(ASPECT_CARD_THEMES).map(
          (theme) => `${theme.accent}/${theme.warm}/${theme.cool}`,
        ),
      ).size,
    ).toBe(5);
    for (const id of BODY_IDS) {
      expect(BODY_IDENTITY[id].name).toBeTruthy();
      expect(BODY_IDENTITY[id].color).toMatch(/^#[a-f0-9]{6}$/);
    }
    for (const aspect of ASPECT_TYPES) {
      const preview = aspectPreviewModel(aspect.id);
      expect(preview.snapshotInstantMs).toBeNull();
      expect(preview.notices).toContain('Design fixture · illustrative placements');
      expectRegistered(preview);
    }
  });
  it('generates twelve deterministic, bounded CSS-only glints', () => {
    const points = cardSparkles('aspect:venus-neptune:square');
    expect(points).toEqual(cardSparkles('aspect:venus-neptune:square'));
    expect(points).not.toEqual(cardSparkles('aspect:sun-moon:square'));
    expect(points).toHaveLength(12);
    expect(points.slice(0, 4).every((point) => point.y <= 15)).toBe(true);
    expect(points.slice(4, 8).every((point) => point.x >= 82)).toBe(true);
    for (const point of points) {
      expect(point.duration).toBeGreaterThanOrEqual(3);
      expect(point.duration).toBeLessThanOrEqual(6);
      expect(point.size).toBeGreaterThanOrEqual(3);
      expect(point.size).toBeLessThanOrEqual(7);
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(100);
    }
  });
});
