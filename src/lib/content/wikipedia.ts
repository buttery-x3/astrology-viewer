import navigation from './data/wikipedia-links.json';

export interface WikipediaOverview {readonly title:string;readonly url:string}
const freezeLinks=(links:readonly WikipediaOverview[])=>Object.freeze(links.map(link=>Object.freeze({...link})));
export const WIKIPEDIA_OVERVIEW_VERSION='1.0.0';
export const WIKIPEDIA_OVERVIEW_REVIEWED_AT=navigation.reviewedAt;
export const WIKIPEDIA_OVERVIEWS:Readonly<Record<string,readonly WikipediaOverview[]>>=Object.freeze(Object.fromEntries(
  Object.entries({...navigation.links,...navigation.featureLinks}).map(([id,links])=>[id,freezeLinks(links)]),
));
const none:readonly WikipediaOverview[]=Object.freeze([]);

/** General concept navigation, deliberately separate from claim support and numerical provenance. */
export function getWikipediaOverviews(id:string):readonly WikipediaOverview[]{
  return WIKIPEDIA_OVERVIEWS[id]??(id.startsWith('constellation:')?WIKIPEDIA_OVERVIEWS['constellation:*']:undefined)??none;
}
