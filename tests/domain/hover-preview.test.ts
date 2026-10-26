import { describe, expect, it } from 'vitest';
import { BODY_IDS } from '../../src/lib/astronomy/ephemeris';
import { CONTENT_CATALOGUE } from '../../src/lib/content';
import supplemental from '../../src/lib/content/data/supplemental-claims.json';
import { ASPECT_TYPES } from '../../src/lib/domain/chart';
import { aspectPreviewModel, resolveHoverCard } from '../../src/lib/domain/hover-card';
import { BODY_IDENTITY, resolveCardTheme } from '../../src/lib/domain/hover-card-themes';
import { featurePreviewStudies, hoverPreview } from '../../src/lib/domain/hover-preview';
import { FEATURE_KINDS } from '../../src/lib/domain/scene-hit';

describe('dedicated compact preview presentation', () => {
  it('omits calculation facts without mutating the full shared reading', () => {
    for (const aspect of ASPECT_TYPES) {
      const model = aspectPreviewModel(aspect.id),
        original = structuredClone(model),
        preview = hoverPreview(model);
      expect(model).toEqual(original);
      expect(model.facts.map((fact) => fact.label)).toContain('Configured orb');
      expect(preview).not.toHaveProperty('facts');
      expect(preview.sections).toEqual(model.sections);
      expect(preview.sections).toHaveLength(3);
      expect(preview.aspect?.bodyA.sign.id).toBe('aries');
      expect(preview.notices).toEqual(model.notices);
    }
  });
  it('retains complete body meaning, sign and house claims', () => {
    const body = featurePreviewStudies().find((model) => model.kind === 'body')!,
      preview = hoverPreview(body);
    expect(preview.identity).toEqual(['Capricorn', 'House 10']);
    expect(preview.sections.map((section) => section.id)).toEqual([
      'body:moon',
      'body-in-sign:moon:capricorn',
      'body-in-house:moon:10',
    ]);
    expect(preview.sections.flatMap((section) => section.paragraphs)).toEqual(
      body.sections.flatMap((section) => section.paragraphs),
    );
    expect(preview.sections[1]?.paragraphs[0]?.text).toContain(
      'private sensitivity still needs acknowledgment',
    );
  });
  it('distinguishes a longitude marker from its label connector without showing implementation roles', () => {
    const body = featurePreviewStudies().find((model) => model.kind === 'body')!;
    const marker = hoverPreview({...body,facts:[{label:'Feature role',value:'Longitude anchor · projection on the ecliptic'}]});
    const connector = hoverPreview({...body,facts:[{label:'Feature role',value:'Caption leader · connects the label to its ecliptic longitude anchor'}]});
    expect(marker.title).toBe('Moon · ecliptic longitude marker');
    expect(connector.title).toBe('Moon · label connector to the ecliptic');
    expect(connector.sections).toEqual(body.sections);
    expect(connector).not.toHaveProperty('facts');
  });
  it('removes repeated astrocartography introduction only from line previews', () => {
    const fixture = featurePreviewStudies().find((model) => model.kind === 'astro-line')!;
    for (const body of BODY_IDS)
      for (const angle of ['ac', 'dc', 'mc', 'ic']) {
        const model = {
          ...fixture,
          id: `astro:${body}:${angle}`,
          entityId: `astro:${body}:${angle}`,
          title: `${BODY_IDENTITY[body].name} · ${angle.toUpperCase()}`,
        };
        const preview = hoverPreview(model);
        expect(preview.sections.map((section) => section.id)).not.toContain('astro:overview');
        expect(preview.sections).toHaveLength(2);
        expect(preview.caption).toBe('Rising across the geometric horizon');
        expect(preview.title).toMatch(/Rising|Setting|Upper meridian|Lower meridian/);
        expect(model.sections.map((section) => section.id)).toContain('astro:overview');
      }
    const layer = resolveHoverCard(
      {
        id: 'layer:astrocartography',
        entityId: 'layer:astrocartography',
        name: 'Astrocartography',
        kind: 'layer',
      },
      { snapshot: null },
    )!;
    expect(hoverPreview(layer).sections.map((section) => section.id)).toContain('astro:overview');
  });
  it('keeps critical notices and actual historical interval identity', () => {
    const fixture = featurePreviewStudies()[0]!;
    const notices = [
      'Provisional birth time',
      'Previous calculated snapshot · update pending',
      'Comparison · Placidus',
      'Undefined at this latitude',
    ];
    const preview = hoverPreview({
      ...fixture,
      kind: 'trail',
      notices,
      facts: [
        { label: 'Frame', value: 'Relative to stars' },
        { label: 'Relative to displayed moment', value: 'Past' },
        { label: 'Segment begins', value: '1987-04-26 · 15:00:00 UTC' },
        { label: 'Segment ends', value: '1987-04-26 · 16:00:00 UTC' },
        { label: 'Displayed moment', value: '2000-01-01 · 12:00:00 UTC' },
      ],
    });
    expect(preview.notices).toEqual(notices);
    expect(preview.identity.join(' ')).toContain('Past');
    expect(preview.identity.join(' ')).toContain(
      '1987-04-26 · 15:00:00 UTC → 1987-04-26 · 16:00:00 UTC',
    );
    expect(preview.identity.join(' ')).not.toContain('2000-01-01');
  });
  it('uses registered complete claims in every representative study', () => {
    const claims = new Map([
      ...CONTENT_CATALOGUE.flatMap((entry) =>
        entry.claims.map(
          (claim, index) => [entry.existingClaimId ?? `${entry.id}:${index}`, claim.text] as const,
        ),
      ),
      ...supplemental.map((claim) => [claim.id, claim.text] as const),
    ]);
    expect(new Set(featurePreviewStudies().map((model) => model.kind)).size).toBe(9);
    for (const model of featurePreviewStudies())
      for (const paragraph of hoverPreview(model).sections.flatMap((section) => section.paragraphs))
        expect(claims.get(paragraph.claimId)).toBe(paragraph.text);
  });
});

describe('expressive feature family themes', () => {
  it('gives every feature family a complete colour palette', () => {
    for (const kind of FEATURE_KINDS) {
      const theme = resolveCardTheme({
        kind,
        entityId: `${kind}:1`,
        glyph: { key: kind, color: '#c4d4df' },
      });
      for (const key of ['accent', 'warm', 'cool'] as const)
        expect(theme[key]).toMatch(/^#[a-f0-9]{6}$/);
      expect(theme.warm).not.toBe(theme.cool);
    }
  });
  it('keeps body identity across body, trail and all geographic angles', () => {
    for (const body of BODY_IDS)
      for (const kind of ['body', 'trail', 'astro-line'] as const) {
        const entityId = kind === 'astro-line' ? `astro:${body}:ac` : `${kind}:${body}`;
        expect(
          resolveCardTheme({
            kind,
            entityId,
            glyph: { key: body, color: BODY_IDENTITY[body].color },
          }).accent,
        ).toBe(BODY_IDENTITY[body].color);
      }
  });
});
