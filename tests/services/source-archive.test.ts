import { describe,expect,it } from 'vitest';
import { gzipSync } from 'node:zlib';
import { sourceArchiveText } from '../helpers/source-archive';

const revision='a'.repeat(40),target=`spatial-astrology-${revision}/source-revision.txt`;
function tar(entries:{name:string;body:string;type?:string;prefix?:string}[]):Buffer{
  const pieces:Buffer[]=[];
  for(const entry of entries){
    const header=Buffer.alloc(512),body=Buffer.from(entry.body);
    header.write(entry.name,0,100,'utf8');header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);
    header.write(`${body.length.toString(8).padStart(11,'0')}\0`,124);header.write('00000000000\0',136);header.fill(32,148,156);
    header[156]=(entry.type??'0').charCodeAt(0);header.write('ustar\0',257);header.write('00',263);
    if(entry.prefix)header.write(entry.prefix,345,155,'utf8');
    header.write(`${header.reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')}\0 `,148);
    pieces.push(header,body,Buffer.alloc((512-body.length%512)%512));
  }
  return Buffer.concat([...pieces,Buffer.alloc(1024)]);
}
describe('bounded source identity reading without filesystem extraction',()=>{
  it('reads the exact revision text in a regular Git-style TAR entry',()=>{
    const archive=gzipSync(tar([{name:target,body:`${revision}\n`}]));
    expect(sourceArchiveText(archive,target)).toBe(`${revision}\n`);
  });
  it('checks header integrity and rejects truncated or incomplete archives',()=>{
    const bytes=tar([{name:target,body:revision}]);bytes[0]=33;
    expect(()=>sourceArchiveText(gzipSync(bytes),target)).toThrow('checksum');
    expect(()=>sourceArchiveText(gzipSync(tar([{name:target,body:revision}]).subarray(0,1024)),target)).toThrow('incomplete');
    expect(()=>sourceArchiveText(gzipSync(Buffer.from('not a TAR')),target)).toThrow('block aligned');
  });
  it('rejects unsafe paths, duplicates and nonregular identity entries',()=>{
    expect(()=>sourceArchiveText(gzipSync(tar([{name:'../outside',body:''},{name:target,body:revision}])),target)).toThrow('Unsafe');
    expect(()=>sourceArchiveText(gzipSync(tar([{name:target,body:revision},{name:target,body:revision}])),target)).toThrow('Duplicate');
    expect(()=>sourceArchiveText(gzipSync(tar([{name:target,body:'',type:'2'}])),target)).toThrow('regular');
  });
  it('bounds decompression and requires an actual identity entry',()=>{
    expect(()=>sourceArchiveText(gzipSync(tar([{name:target,body:revision}])),target,512)).toThrow();
    expect(()=>sourceArchiveText(gzipSync(tar([{name:'unrelated',body:'text'}])),target)).toThrow('absent');
  });
  it('accepts Git global commit metadata, USTAR prefixes and an explicit PAX path',()=>{
    const global={name:'pax_global_header',body:`52 comment=${revision}\n`,type:'g'};
    const prefixed=gzipSync(tar([global,{name:'source-revision.txt',prefix:`spatial-astrology-${revision}`,body:revision}]));
    expect(sourceArchiveText(prefixed,target)).toBe(revision);
    const record=`path=${target}\n`;let length=Buffer.byteLength(record)+3;
    while(length!==Buffer.byteLength(record)+String(length).length+1)length=Buffer.byteLength(record)+String(length).length+1;
    const extended=gzipSync(tar([global,{name:'path_extension',body:`${length} ${record}`,type:'x'},{name:'placeholder',body:revision}]));
    expect(sourceArchiveText(extended,target)).toBe(revision);
  });
});
