import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import catalogue from '../src/lib/content/data/catalogue.json';
import sources from '../src/lib/content/data/sources.json';
import supplemental from '../src/lib/content/data/supplemental-claims.json';
import { REQUIRED_CONTENT_IDS, validateContentCatalogue } from '../src/lib/content/validation';

const validation=validateContentCatalogue(catalogue,sources,supplemental);
if(!validation.valid)throw new Error(validation.issues.join('\n'));
const textFiles=new Map<string,string>();
async function code(path:string){if(!textFiles.has(path))textFiles.set(path,await readFile(path,'utf8'));return textFiles.get(path)!;}
for(const entry of catalogue)if('reusedFrom'in entry){
  const text=await code(entry.reusedFrom!);
  for(const claim of entry.claims)if(!text.includes(claim.text))throw new Error(`Reused source claim has drifted: ${entry.id}.`);
}
for(const claim of supplemental)if(!(await code(claim.sourceCode)).includes(claim.text))throw new Error(`Supplementary source prose has drifted: ${claim.id}.`);
const construction=await code('src/lib/domain/house-construction.ts');
const stepText:string[]=[],notes:string[]=[];
const constructionSource=ts.createSourceFile('house-construction.ts',construction,ts.ScriptTarget.Latest,true);
const collect=(node:ts.Node)=>{
  if(ts.isVariableDeclaration(node)&&node.name.getText(constructionSource)==='STEP_TEXT'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer))for(const property of node.initializer.properties)if(ts.isPropertyAssignment(property)&&ts.isArrayLiteralExpression(property.initializer))for(const element of property.initializer.elements)if(ts.isStringLiteral(element))stepText.push(element.text);
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.getText(constructionSource)==='guide.notes.push'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))notes.push(node.arguments[0].text);
  ts.forEachChild(node,collect);
};collect(constructionSource);
if(stepText.length!==21)throw new Error('Expected 21 construction stage explanations; review the supplemental claim registry.');
for(const text of [...stepText,...notes])if(!supplemental.some((claim)=>claim.text===text))throw new Error(`Construction prose missing from canonical-page budget: ${text}`);
const provenance=await code('src/lib/ui/CalculationProvenance.svelte');
for(const match of provenance.matchAll(/<p(?:\s[^>]*)?>([^<{}]+)<\/p>/g))if(!supplemental.some((claim)=>claim.sourceCode==='src/lib/ui/CalculationProvenance.svelte'&&claim.text===match[1]))throw new Error(`Provenance prose missing from source budget: ${match[1]}`);
const sha256=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const files=['catalogue.json','sources.json','supplemental-claims.json','curation-provenance.json','wikipedia-links.json'];
const dataFiles=Object.fromEntries(await Promise.all(files.map(async(name)=>{
  const bytes=await readFile(`src/lib/content/data/${name}`);return [name,{sha256:sha256(bytes),bytes:bytes.length}];
})));
const budgetText=`${JSON.stringify({catalogueVersion:'1.1.0',policy:'One logical claim per canonical webpage; summary/claim duplicates and reused M3 scene definitions count once. Includes M5 construction-stage prose, shared notes and M10 original project explanations.',pages:validation.budgets},null,2)}\n`;
const manifest={
  catalogueVersion:'1.1.0',reviewedAt:'2026-10-26',status:'reviewed',entryCount:validation.entries,sourceCount:validation.sources,
  requiredContentIdsSha256:sha256(JSON.stringify([...REQUIRED_CONTENT_IDS].sort())),
  files:{...dataFiles,'word-budgets.json':{sha256:sha256(budgetText),bytes:Buffer.byteLength(budgetText)}},
  byKind:Object.fromEntries([...new Set(catalogue.map((entry)=>entry.kind))].map((kind)=>[kind,catalogue.filter((entry)=>entry.kind===kind).length])),
  claimsByRole:Object.fromEntries([...new Set(catalogue.flatMap((entry)=>entry.claims.map((claim)=>claim.role)))].map((role)=>[role,catalogue.flatMap((entry)=>entry.claims).filter((claim)=>claim.role===role).length])),
  reviewScope:'Agent source curation during M6 and M10 authoring; integration validates exact coverage, roles, source references, source-code reuse and combined canonical-page word budgets. No runtime interpretation generation. Human claim-to-passage editorial review remains an external release gate.',
  limitations:['Practitioner sources establish attributed traditions, not predictive effects.','Historical civil time and birth time can remain uncertain despite precise calculation.','Some house definitions were reviewed via indexed primary-page text during publisher outages.','Product-rule sources are pinned to a reviewed project commit; external publisher pages can change after the recorded review date.'],
};
const manifestText=`${JSON.stringify(manifest,null,2)}\n`;
if(process.argv.includes('--write')){
  await writeFile('src/lib/content/data/word-budgets.json',budgetText);
  await writeFile('src/lib/content/data/manifest.json',manifestText);
}else{
  if(await readFile('src/lib/content/data/word-budgets.json','utf8')!==budgetText)throw new Error('Content word budgets changed; review and regenerate with --write.');
  if(await readFile('src/lib/content/data/manifest.json','utf8')!==manifestText)throw new Error('Content manifest/hash changed; review and regenerate with --write.');
}
console.log(`Content ${manifest.catalogueVersion}: ${validation.entries} reviewed entries, ${validation.sources} attributed sources, all ${validation.budgets.length} canonical pages within budget.`);
