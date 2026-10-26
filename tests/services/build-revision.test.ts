import { afterEach,expect,it,vi } from 'vitest';
import { mkdtemp,mkdir,readFile,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { resolveBuildRevision } from '../../scripts/build-revision';
import { SOURCE_BASE_REVISION } from '../../src/lib/build-base';
import { inside } from '../../server/manifest';
const base=path.resolve('.cache/build-revision-tests'),roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0)){if(!inside(base,root)||root===base)throw new Error('Unsafe build-revision test cleanup.');await rm(root,{recursive:true,force:true});}});
it('uses explicit revision, current checkout HEAD, and only falls back when Git metadata is absent',async()=>{
  await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'test-'));roots.push(root);const read=vi.fn(()=> 'a'.repeat(40));expect(resolveBuildRevision(root,undefined,read)).toBe(SOURCE_BASE_REVISION);expect(read).not.toHaveBeenCalled();
  await writeFile(path.join(root,'.git'),'gitdir: fixture');expect(resolveBuildRevision(root,undefined,read)).toBe('a'.repeat(40));expect(read).toHaveBeenCalledWith(root);expect(resolveBuildRevision(root,'b'.repeat(40),()=>{throw new Error('unused');})).toBe('b'.repeat(40));
  expect(()=>resolveBuildRevision(root,undefined,()=>{throw new Error('broken');})).toThrow('Cannot identify');for(const invalid of ['main','','A'.repeat(40),'c'.repeat(39)])expect(()=>resolveBuildRevision(root,invalid,read)).toThrow('exact');
});
it('keeps the exact expanded archive identity without Git and rejects malformed archive metadata',async()=>{
  await mkdir(base,{recursive:true});const root=await mkdtemp(path.join(base,'archive-'));roots.push(root);const file=path.join(root,'source-revision.txt'),read=vi.fn(()=> 'a'.repeat(40));
  await writeFile(file,'$Format:%H$\n');expect(resolveBuildRevision(root,undefined,read)).toBe(SOURCE_BASE_REVISION);
  // Controlled content exactly matches Git archive's export-subst expansion of %H.
  await writeFile(file,'d'.repeat(40)+'\n');expect(resolveBuildRevision(root,undefined,read)).toBe('d'.repeat(40));expect(read).not.toHaveBeenCalled();expect(resolveBuildRevision(root,'e'.repeat(40),read)).toBe('e'.repeat(40));
  for(const malformed of ['', 'main', 'D'.repeat(40), 'd'.repeat(39), 'd'.repeat(200)]){await writeFile(file,malformed);expect(()=>resolveBuildRevision(root,undefined,read)).toThrow(/source revision/i);}
  await writeFile(file,'d'.repeat(40));await writeFile(path.join(root,'.git'),'gitdir: fixture');expect(resolveBuildRevision(root,undefined,read)).toBe('a'.repeat(40));expect(()=>resolveBuildRevision(root,undefined,()=>{throw new Error('broken checkout');})).toThrow('Cannot identify');
  expect(await readFile('.gitattributes','utf8')).toMatch(/^source-revision\.txt export-subst$/m);
});
