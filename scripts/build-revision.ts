import { existsSync,readFileSync,statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { SOURCE_BASE_REVISION } from '../src/lib/build-base';

/** Git archive expands the tracked placeholder, retaining exact identity without .git. */
function archivedRevision(root:string):string{
  const file=path.join(root,'source-revision.txt');let revision:string;
  try{if(statSync(file).size>128)throw new Error('Source revision identity exceeds its expected bound.');revision=readFileSync(file,'utf8').trim();}
  catch(error){if(error instanceof Error&&'code'in error&&error.code==='ENOENT')return SOURCE_BASE_REVISION;throw new Error('Cannot read the archived source revision identity.',{cause:error});}
  if(revision==='$Format:%H$')return SOURCE_BASE_REVISION;
  if(!/^[a-f0-9]{40}$/.test(revision))throw new Error('Archived source revision must be an exact 40-character lowercase Git revision.');
  return revision;
}
/** Ordinary builds infer HEAD; absent .git uses export-subst identity before baseline fallback. */
export function resolveBuildRevision(root:string,override?:string,readHead:(root:string)=>string=directory=>execFileSync('git',['rev-parse','HEAD'],{cwd:directory,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()):string{
  let revision=override;
  if(revision===undefined){
    if(!existsSync(path.join(root,'.git')))return archivedRevision(root);
    try{revision=readHead(root);}catch{throw new Error('Cannot identify this checkout. Set an explicit VITE_BUILD_REVISION or repair Git metadata.');}
  }
  if(!/^[a-f0-9]{40}$/.test(revision))throw new Error('VITE_BUILD_REVISION must be an exact 40-character lowercase Git revision.');
  return revision;
}
