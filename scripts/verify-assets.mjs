import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const engine=JSON.parse(readFileSync('src/lib/astronomy/generated/build-manifest.json','utf8'));
const data=JSON.parse(readFileSync('public/data/ephemeris/manifest.json','utf8'));
for(const [base,manifest] of [['src/lib/astronomy/generated',engine],['public/data/ephemeris',data]]){
  for(const entry of manifest.files){
    const bytes=readFileSync(`${base}/${entry.name}`);
    if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)
      throw new Error(`Asset differs from checked-in manifest: ${entry.name}`);
  }
}
console.log('Engine and ephemeris asset checksums verified.');
