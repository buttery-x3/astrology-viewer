/** Original explorer conventions; exact strings are included in the supplementary claim registry. */
export const PROJECT_EXPLANATIONS = Object.freeze([
  {id:'hover:earth',text:'The schematic Earth locates the observer beneath the surrounding sky. Its size is illustrative; geographic directions share the chart’s fixed frame.'},
  {id:'hover:observer',text:'The observer sets the local horizon and house calculation. Changing location does not change geocentric planetary longitudes at the same instant.'},
  {id:'hover:constellation',text:'An official constellation region is an area of sky, independent of the twelve equal tropical signs.'},
  {id:'hover:asterism',text:'These connected stars follow one modern Western drawing convention. The figure is distinct from the official constellation region and from a tropical sign.'},
  {id:'hover:star',text:'Catalogue stars use mean J2000 directions with linear proper motion. The display omits annual aberration, parallax and variable brightness.'},
  {id:'hover:earth-house',text:'This is a radial projection of the current chart’s longitude house onto Earth. It is not a relocated house chart for every location inside the section.'},
  {id:'hover:history',text:'A boundary history sample preserves its indexed cusp and calculation time. Undefined samples and discontinuous jumps are not connected as a continuous boundary.'},
  {id:'hover:trail-segment',text:'A segment summarizes the interval between sampled directions. Its interior is approximate; current placements are not substituted for an older sample.'},
  {id:'hover:sign-constellation',text:'Tropical signs divide ecliptic longitude into twelve equal intervals. They do not share the unequal boundaries of the constellations.'},
  {id:'hover:house-boundary',text:'An indexed cusp separates the previous house from the house with that cusp number. Membership follows the system’s directed longitude interval.'},
  {id:'hover:compass',text:'Compass labels mark local horizon directions: north 0°, east 90°, south 180° and west 270° azimuth.'},
  {id:'hover:houses-layer',text:'House displays extend the selected system’s indexed longitude intervals away from the ecliptic. Display modes change their presentation while preserving the same house membership.'},
  {id:'hover:aspects-layer',text:'Aspect strands connect bodies whose ecliptic longitude separation falls within an enabled aspect’s configured orb. The actual angle between their sky directions can differ.'},
  {id:'hover:bodies-layer',text:'Body markers show geocentric planetary directions for the displayed moment. Their sizes and distances on the surrounding sky are illustrative.'},
].map(entry=>Object.freeze({...entry,role:'project-convention' as const})));
const explanations=new Map(PROJECT_EXPLANATIONS.map(entry=>[entry.id,entry]));
export function getProjectExplanation(id:string){return explanations.get(id);}
