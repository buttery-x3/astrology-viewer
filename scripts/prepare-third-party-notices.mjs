import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

// Inventory the actual installed production records and preserve their supplied
// notice bytes. Data licences remain separate in docs/data-and-licensing.md.
const root=JSON.parse(await readFile('package-lock.json','utf8'));
const packages=[];
const reviewedDeclarations=new Set(['is-reference@3.0.3','locate-character@3.0.0','stream-source@0.3.5']);
for(const [path,record] of Object.entries(root.packages)){
  if(!path||record.dev)continue;
  const notices=[];
  for(const name of (await readdir(path)).sort())if(/^(?:licen[sc]e|copying|notice|copyright|authors)(?:[.\-_]|$)/i.test(name)){
    const full=join(path,name);
    let content;
    try{content=await readFile(full);}catch(error){if(error.code==='EISDIR')continue;throw error;}
    notices.push({file:name,sha256:createHash('sha256').update(content).digest('hex'),bytes:content.length,text:content.toString('utf8')});
  }
  const metadata=JSON.parse(await readFile(join(path,'package.json'),'utf8'));
  const packageName=record.name??path.slice(path.lastIndexOf('node_modules/')+13);
  const hasFullNotice=notices.length>0;
  if(!hasFullNotice){
    if(!reviewedDeclarations.has(`${packageName}@${record.version}`))throw new Error(`No supplied licence/notice file found for ${path}. Review it explicitly before release.`);
    const noticeFile=packageName==='stream-source'?'dist/stream-source.js':'README.md';
    const supplied=await readFile(join(path,noticeFile),'utf8');
    const excerpt=packageName==='stream-source'?supplied.split(/\r?\n/)[0]:supplied.slice(supplied.lastIndexOf('## License'));
    notices.push({file:noticeFile,excerpt:true,text:excerpt,sourceFileSha256:createHash('sha256').update(supplied).digest('hex')});
  }
  packages.push({package:packageName,version:record.version,license:record.license??'UNDECLARED',resolved:record.resolved,installedPath:path,author:metadata.author,repository:metadata.repository,noticeScope:hasFullNotice?'supplied licence/notice file':'upstream declaration/banner only; no complete standalone licence supplied',notices});
}
packages.sort((a,b)=>a.package.localeCompare(b.package)||a.installedPath.localeCompare(b.installedPath));
const inventory={schema:1,scope:'Installed package-lock production records and verbatim supplied top-level licence/notice files. Metadata is not an independent compatibility opinion; data terms and build tooling are separate.',packageLockSha256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),packages};
const target='docs/third-party/npm-production-notices.json';
const content=`${JSON.stringify(inventory,null,2)}\n`;
if(process.argv.includes('--check')){
  if(await readFile(target,'utf8')!==content)throw new Error(`${target} differs from installed lockfile/notice bytes; review and regenerate.`);
}else{
  await mkdir('docs/third-party',{recursive:true});await writeFile(target,content);
}
console.log(`${basename(target)}: ${packages.length} production records; ${packages.filter(p=>p.noticeScope.startsWith('supplied')).length} supplied full notice files, ${packages.filter(p=>!p.noticeScope.startsWith('supplied')).length} explicitly recorded upstream shorthand/banner cases.`);
