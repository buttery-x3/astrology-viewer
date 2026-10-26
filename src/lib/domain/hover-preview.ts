import { getContent, getSupplementalClaim } from '../content';
import { getProjectExplanation } from '../content/project-explanations';
import type { HoverCardModel, HoverSection } from './hover-card';
import { resolveCardTheme } from './hover-card-themes';

export const GEOGRAPHIC_ANGLE_NAMES = {
  ac: 'Rising',
  dc: 'Setting',
  mc: 'Upper meridian',
  ic: 'Lower meridian',
} as const;

/** Preview presentation deliberately has no fact table. The shared model remains intact for inspectors. */
export function hoverPreview(model: HoverCardModel) {
  const fact = (label: string) => model.facts.find((item) => item.label === label)?.value;
  const identity: string[] = [];
  const add = (...values: (string | undefined)[]) =>
    identity.push(...values.filter((value): value is string => !!value));
  let title = model.title;
  let caption: string | undefined;
  const role = fact('Feature role') ?? '';
  const angle = model.entityId.match(/^astro:[a-z]+:(ac|dc|mc|ic)$/)?.[1] as
    keyof typeof GEOGRAPHIC_ANGLE_NAMES | undefined;
  switch (model.kind) {
    case 'body': {
      const placement = model.sections.find((section) => section.id.startsWith('body-in-sign:'));
      const house = model.sections.find((section) => section.id.startsWith('body-in-house:'));
      add(
        placement?.title.replace(`${model.title} in `, ''),
        house ? `House ${house.id.split(':').at(-1)}` : undefined,
      );
      if (/latitude projection/i.test(role)) title = `${model.title} · projection to the ecliptic`;
      else if (/caption leader/i.test(role))
        title = `${model.title} · label connector to the ecliptic`;
      else if (/longitude anchor/i.test(role))
        title = `${model.title} · ecliptic longitude marker`;
      break;
    }
    case 'aspect':
      if (/measured.*separation/i.test(role)) caption = 'Longitude measurement arc';
      break;
    case 'house':
    case 'boundary':
    case 'earth-house':
      add(fact('System'));
      break;
    case 'angle':
      add(fact('Tropical placement'));
      break;
    case 'star':
      add(fact('Catalogue identity'));
      break;
    case 'constellation':
    case 'asterism':
      add(fact('Abbreviation'));
      break;
    case 'construction':
      add(fact('Boundary'), fact('Stage'));
      break;
    case 'trail':
    case 'history':
      add(fact('Frame'), fact('Relative to displayed moment'));
      if (fact('Segment begins')) add(`${fact('Segment begins')} → ${fact('Segment ends')}`);
      else add(fact('Sample time'));
      if (model.kind === 'history') add(fact('System'));
      break;
    case 'astro-line':
      if (angle) title = `${model.title} — ${GEOGRAPHIC_ANGLE_NAMES[angle]}`;
      caption = fact('Angular condition');
      break;
    case 'layer':
      add(fact('Display'));
      break;
    case 'reference':
      if (model.entityId === 'reference:observer') add(fact('Latitude'), fact('Longitude · east'));
      break;
  }
  const sections = model.sections
    .filter((section) => model.kind !== 'astro-line' || section.id !== 'astro:overview')
    .map((section) => ({
      ...section,
      paragraphs: section.paragraphs.map((paragraph) => ({ ...paragraph })),
    }));
  return {
    id: model.id,
    kind: model.kind,
    title,
    kicker: model.kicker,
    glyph: model.glyph,
    identity,
    caption,
    notices: [...model.notices],
    sections,
    aspect: model.aspect,
    theme: resolveCardTheme(model),
    firstTraditionalSection: sections.findIndex((section) =>
      section.paragraphs.some((paragraph) => paragraph.role === 'tradition'),
    ),
  };
}
export type HoverPreview = ReturnType<typeof hoverPreview>;

function studySection(id: string, title: string): HoverSection {
  const entry = getContent(id);
  if (entry)
    return {
      id,
      title,
      paragraphs: entry.claims
        .filter((claim) => (id.startsWith('body:') ? claim.role === 'tradition' : true))
        .map((claim, index) => ({
          text: claim.text,
          role: claim.role,
          claimId:
            entry.existingClaimId ??
            `${id}:${entry.claims.indexOf(claim) >= 0 ? entry.claims.indexOf(claim) : index}`,
        })),
    };
  const claim = getProjectExplanation(id) ?? getSupplementalClaim(id);
  return {
    id,
    title,
    paragraphs: claim ? [{ claimId: claim.id, role: claim.role, text: claim.text }] : [],
  };
}

/** Explicit illustrative fixtures; no invented placements enter a calculated chart. */
export function featurePreviewStudies(): HoverCardModel[] {
  const fixtures: {
    kind: HoverCardModel['kind'];
    id: string;
    title: string;
    kicker: string;
    glyph: string;
    sections: [string, string][];
    facts?: HoverCardModel['facts'];
  }[] = [
    {
      kind: 'body',
      id: 'body:moon',
      title: 'Moon',
      kicker: 'Celestial body',
      glyph: 'moon',
      sections: [
        ['body:moon', 'Body meaning'],
        ['body-in-sign:moon:capricorn', 'Moon in Capricorn'],
        ['body-in-house:moon:10', 'Moon in house 10'],
      ],
    },
    {
      kind: 'sign',
      id: 'sign:scorpio',
      title: 'Scorpio',
      kicker: 'Tropical sign',
      glyph: 'scorpio',
      sections: [
        ['sign:scorpio', 'Traditional interpretation'],
        ['hover:sign-constellation', 'In the sky'],
      ],
    },
    {
      kind: 'house',
      id: 'house:7',
      title: 'House 7',
      kicker: 'Longitude house',
      glyph: 'house',
      sections: [['house:7', 'Traditional interpretation']],
      facts: [{ label: 'System', value: 'Whole Sign' }],
    },
    {
      kind: 'angle',
      id: 'angle:asc',
      title: 'Ascendant',
      kicker: 'Sky angle',
      glyph: 'reference',
      sections: [
        ['angle:asc', 'Geometric definition'],
        ['astro:angle:ac', 'Traditional angle theme'],
      ],
    },
    {
      kind: 'star',
      id: 'star:32263',
      title: 'Sirius',
      kicker: 'Catalogue star',
      glyph: 'star',
      sections: [['hover:star', 'Catalogue position']],
      facts: [{ label: 'Catalogue identity', value: 'HYG 32263' }],
    },
    {
      kind: 'asterism',
      id: 'asterism:ori',
      title: 'Orion',
      kicker: 'Constellation asterism',
      glyph: 'constellation',
      sections: [['hover:asterism', 'What this represents']],
    },
    {
      kind: 'astro-line',
      id: 'astro:venus:ac',
      title: 'Venus · AC',
      kicker: 'Astrocartography line',
      glyph: 'venus',
      sections: [
        ['astro:overview', 'Geometric context'],
        ['astro:body:venus', 'Traditional body theme'],
        ['astro:angle:ac', 'Traditional angle theme'],
      ],
      facts: [{ label: 'Angular condition', value: 'Rising across the geometric horizon' }],
    },
    {
      kind: 'earth-house',
      id: 'earth:house:primary:4',
      title: 'House 4',
      kicker: 'Projected chart house',
      glyph: 'house',
      sections: [
        ['hover:earth-house', 'Projection meaning'],
        ['house:4', 'Traditional interpretation'],
      ],
      facts: [{ label: 'System', value: 'Placidus' }],
    },
    {
      kind: 'layer',
      id: 'layer:aspects',
      title: 'Longitude aspects',
      kicker: 'Layer guide',
      glyph: 'layer',
      sections: [['hover:aspects-layer', 'Layer purpose']],
      facts: [{ label: 'Display', value: 'Enabled' }],
    },
  ];
  return fixtures.map((fixture) => ({
    id: fixture.id,
    entityId: fixture.id,
    kind: fixture.kind,
    title: fixture.title,
    kicker: fixture.kicker,
    glyph: { key: fixture.glyph, color: '#b8d1e6' },
    facts: fixture.facts ?? [],
    notices: ['Design fixture · illustrative identity'],
    sections: fixture.sections.map(([id, title]) => studySection(id, title)),
    contentIds: fixture.sections.map(([id]) => id),
    snapshotInstantMs: null,
  }));
}
