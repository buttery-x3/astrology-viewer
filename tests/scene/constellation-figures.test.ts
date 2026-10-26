import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import topology from '../../vendor/stellarium-modern/index.json';
import data from '../../src/lib/scene/data/constellation-figures.json';
import manifest from '../../src/lib/scene/data/figure-manifest.json';
import {CATALOGUE_STARS,CONSTELLATIONS,catalogueStarDirection} from '../../src/lib/scene/sky-data';
import {CONSTELLATION_FIGURES,FIGURE_STARS,FIGURE_SUPPORT_STARS,buildFigurePaths,figureStar,interpolateFigureSegment} from '../../src/lib/scene/constellation-figures';
import {deriveFigures} from '../../scripts/prepare-constellation-figures.mjs';

describe('pinned modern Western figure topology',()=>{
  it('retains exact upstream bytes, explicit data licence and derived checksums',()=>{
    for(const asset of manifest.sources.filter(source=>source.file.startsWith('vendor/'))){const bytes=readFileSync(asset.file);expect(bytes.length).toBe(asset.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(asset.gitBlob);expect(asset.url).toContain(manifest.revision);}
    for(const asset of manifest.assets){const bytes=readFileSync(`src/lib/scene/data/${asset.file}`);expect(bytes.length).toBe(asset.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);}
    expect(readFileSync(manifest.notice,'utf8')).toContain('Text and data: CC BY-SA 4.0');
    expect(manifest.license).toBe('CC-BY-SA-4.0');expect(manifest.revision).toBe('2b10b1a3bb534eb4e7586751054bf67b36c22e53');
  });
  it('preserves all 88 identities and every ordered HIP connection without nearest-position matching',()=>{
    expect(CONSTELLATION_FIGURES).toHaveLength(88);expect(data.endpoints).toHaveLength(710);expect(FIGURE_STARS).toHaveLength(710);
    expect(new Set(CONSTELLATION_FIGURES.map(figure=>figure.constellationId))).toEqual(new Set(CONSTELLATIONS.map(value=>value.id)));
    const mapping=new Map(data.endpoints.map(endpoint=>[endpoint.hip,endpoint.hygId]));
    for(const original of topology.constellations){const id=`asterism:${original.id.split(' ').at(-1)!.toLowerCase()}`,figure=CONSTELLATION_FIGURES.find(item=>item.id===id)!;expect(figure.paths).toEqual(original.lines.map(path=>path.map(hip=>mapping.get(hip))));const segments=figure.paths.flatMap(path=>path.slice(1).map((id,index)=>[id,path[index]!].sort((a,b)=>a-b).join(':')));expect(new Set(segments).size).toBe(segments.length);}
    expect(CONSTELLATION_FIGURES.flatMap(figure=>figure.paths)).toHaveLength(219);
    expect(CONSTELLATION_FIGURES.reduce((sum,figure)=>sum+figure.paths.reduce((n,path)=>n+path.length-1,0),0)).toBe(695);
    expect(CONSTELLATION_FIGURES.find(figure=>figure.id==='asterism:ser')!.paths).toHaveLength(2);
  });
  it('adds only nine fainter support records without modifying the default magnitude subset',()=>{
    expect(CATALOGUE_STARS).toHaveLength(2865);expect(FIGURE_SUPPORT_STARS).toHaveLength(9);
    const bright=new Map(CATALOGUE_STARS.map(star=>[star[0],star]));
    expect(FIGURE_SUPPORT_STARS.every(star=>!bright.has(star[0])&&star[2]>5.5)).toBe(true);expect(Math.max(...FIGURE_SUPPORT_STARS.map(star=>star[2]))).toBe(6.65);
    for(const star of FIGURE_STARS){expect(figureStar(star[0])).toEqual(star);if(bright.has(star[0]))expect(star).toEqual(bright.get(star[0]));}
    expect(figureStar(-1)).toBeUndefined();
  });
  for(const jd of [2415020.5,2451545,2488069.5])it(`aligns every actual endpoint and unit spherical arc at JD${jd}`,()=>{
    for(const figure of CONSTELLATION_FIGURES){const paths=buildFigurePaths(figure.id,jd);for(const [index,path]of paths.entries()){
      const ids=figure.paths[index]!;expect(path[0]).toEqual(catalogueStarDirection(figureStar(ids[0]!)!,jd));expect(path.at(-1)).toEqual(catalogueStarDirection(figureStar(ids.at(-1)!)!,jd));
      for(const id of ids){const exact=catalogueStarDirection(figureStar(id)!,jd);expect(path.some(p=>p.x===exact.x&&p.y===exact.y&&p.z===exact.z)).toBe(true);}
      for(let i=0;i<path.length;i++){const p=path[i]!;expect(Math.hypot(p.x,p.y,p.z)).toBeCloseTo(1,12);if(i){const q=path[i-1]!,angle=Math.acos(Math.max(-1,Math.min(1,p.x*q.x+p.y*q.y+p.z*q.z)))*180/Math.PI;expect(angle).toBeLessThanOrEqual(2.000001);}}
    }}
  });
  it('fails closed for missing or ambiguous identifiers and invalid catalogue vectors',()=>{
    const figures={id:'modern',constellations:Array.from({length:88},(_,i)=>({id:`CON modern ${i}`,lines:[[1,2]]}))};
    const header='id,hip,mag,x,y,z,vx,vy,vz,ci,proper,bf\n',first='1,1,1,1,0,0,0,0,0,,,\n';
    expect(()=>deriveFigures(figures,header+first,[])).toThrow('Unresolved HIP 2');
    expect(()=>deriveFigures(figures,header+first+first,[])).toThrow('Ambiguous HIP 1');
    expect(()=>deriveFigures(figures,header+'1,1,1,0,0,0,0,0,0,,,\n',[])).toThrow('Invalid HYG');
    expect(()=>buildFigurePaths('asterism:unknown',2451545)).toThrow('Unknown');expect(()=>buildFigurePaths('asterism:ori',NaN)).toThrow('finite');
    expect(()=>interpolateFigureSegment({x:1,y:0,z:0},{x:-1,y:0,z:0})).toThrow('Antipodal');
  });
});
