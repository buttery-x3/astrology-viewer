/** Pinned Stellarium topology + exact HIP-to-HYG catalogue join; no positional matching. */
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const FIGURE_REVISION='2b10b1a3bb534eb4e7586751054bf67b36c22e53';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
function csvRow(line){const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(value);value='';}else value+=ch;}if(quoted)throw Error('Unclosed catalogue CSV quote.');out.push(value);return out;}
export function deriveFigures(topology,hygText,brightStars){
  if(topology.id!=='modern'||topology.constellations.length!==88)throw Error('Expected the pinned 88 modern figures.');
  const lines=hygText.trim().split('\n'),headings=csvRow(lines.shift().trim()),hips=new Map();
  for(const line of lines){const values=csvRow(line.trim());const row=Object.fromEntries(headings.map((key,i)=>[key,values[i]]));if(!row.hip)continue;const hip=Number(row.hip);if(hips.has(hip))throw Error(`Ambiguous HIP ${hip}.`);hips.set(hip,row);}
  const used=new Map();
  const figures=topology.constellations.map(figure=>{
    const abbreviation=figure.id.split(' ').at(-1).toUpperCase();
    const paths=figure.lines.map(path=>{if(path.length<2)throw Error(`Empty figure path ${figure.id}.`);return path.map(hip=>{
      if(!Number.isSafeInteger(hip)||hip<=0)throw Error(`Unsupported figure endpoint ${hip}.`);
      const row=hips.get(hip);if(!row)throw Error(`Unresolved HIP ${hip}.`);
      const values=['x','y','z','vx','vy','vz'].map(key=>Number(row[key]));if(!values.every(Number.isFinite)||Math.hypot(...values.slice(0,3))===0)throw Error(`Invalid HYG ${row.id}.`);
      const star=[Number(row.id),row.proper||row.bf||`HIP ${hip}`,Number(row.mag),...values,row.ci?Number(row.ci):null];
      if(!Number.isFinite(star[2]))throw Error(`Invalid magnitude HIP ${hip}.`);
      used.set(hip,star);return star[0];
    });});
    return {id:`asterism:${abbreviation.toLowerCase()}`,constellationId:`constellation:${abbreviation.toLowerCase()}`,abbreviation,paths};
  });
  const bright=new Map(brightStars.map(star=>[star[0],star]));
  for(const star of used.values())if(bright.has(star[0])&&JSON.stringify(bright.get(star[0]))!==JSON.stringify(star))throw Error(`HYG ${star[0]} differs from the existing star catalogue.`);
  const endpoints=[...used].sort((a,b)=>a[0]-b[0]).map(([hip,star])=>({hip,hygId:star[0]}));
  const supportStars=[...used.values()].filter(star=>!bright.has(star[0])).sort((a,b)=>a[0]-b[0]);
  if(endpoints.length!==710||supportStars.length!==9)throw Error('Pinned endpoint/support-star coverage changed.');
  return {schema:1,epochJulianDate:2451545,figures,endpoints,supportStars};
}

async function main(){
  const sky=JSON.parse(await readFile('src/lib/scene/data/sky-data-manifest.json','utf8'));
  const topology=await readFile('vendor/stellarium-modern/index.json'),description=await readFile('vendor/stellarium-modern/description.md');
  if(blob(topology)!=='09872ba40293423bd15e37706866cc4782178554'||blob(description)!=='2b8f761ff31b56537d38794667f66827b3e07976')throw Error('Retained Stellarium source bytes differ from pinned Git blobs.');
  if(!description.toString('utf8').includes('Text and data: CC BY-SA 4.0'))throw Error('Expected explicit data licence.');
  const hyg=await readFile(resolve(process.env.HYG_SOURCE_PATH??'.tools/sky-source/hygdata_v41.csv'));
  if(sha256(hyg)!==sky.sources[0].sha256)throw Error('HYG source differs from the pinned catalogue.');
  const bright=JSON.parse(await readFile('src/lib/scene/data/bright-stars.json','utf8'));
  const derived=deriveFigures(JSON.parse(topology.toString('utf8')),hyg.toString('utf8'),bright.stars);
  const bytes=Buffer.from(`${JSON.stringify(derived)}\n`);
  const manifest={schema:1,version:'Stellarium-26.2-modern-HYG-4.1',revision:FIGURE_REVISION,author:'Stellarium team; star positions David Nash / Astronexus HYG v4.1',license:'CC-BY-SA-4.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/',notice:'vendor/stellarium-modern/description.md',changes:'Extracted only the 88 modern constellation line topologies; resolved every HIP ID to the pinned HYG ID; retained nine fainter support stars; no illustrations, unrelated asterisms or cultural descriptions imported into runtime data.',policy:'Modern Western connection convention, not official IAU boundary geometry. Endpoint directions use the identical HYG fixed-J2000 linear proper-motion policy as catalogue stars. Short great-circle interpolation is a display convention.',counts:{figures:88,polylines:219,segments:695,endpoints:710,supportStars:9},sources:[{file:'vendor/stellarium-modern/index.json',url:`https://raw.githubusercontent.com/Stellarium/stellarium/${FIGURE_REVISION}/skycultures/modern/index.json`,gitBlob:blob(topology),sha256:sha256(topology),bytes:topology.length},{file:'vendor/stellarium-modern/description.md',url:`https://raw.githubusercontent.com/Stellarium/stellarium/${FIGURE_REVISION}/skycultures/modern/description.md`,gitBlob:blob(description),sha256:sha256(description),bytes:description.length},{...sky.sources[0],file:'hygdata_v41.csv'}],assets:[{file:'constellation-figures.json',bytes:bytes.length,sha256:sha256(bytes)}]};
  const targets=[['src/lib/scene/data/constellation-figures.json',bytes],['src/lib/scene/data/figure-manifest.json',Buffer.from(`${JSON.stringify(manifest,null,2)}\n`)]];
  for(const [path,value]of targets)if(process.argv.includes('--write'))await writeFile(path,value);else if(!value.equals(await readFile(path)))throw Error(`${path} is not reproducible; inspect sources before --write.`);
  console.log('Verified 88 figures, 710 exact HIP joins, nine support stars and retained source licences.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
