import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd(),latest=JSON.parse(readFileSync('.cache/releases/latest.json','utf8'));
if(!/^[a-f0-9]{40}$/.test(latest.revision)||latest.directory!==`.cache/releases/${latest.revision}`)throw new Error('Build a checked release with npm run release:build first.');
const result=spawnSync(process.execPath,[path.join(root,latest.directory,'server.mjs')],{stdio:'inherit',env:process.env});process.exit(result.status??1);
