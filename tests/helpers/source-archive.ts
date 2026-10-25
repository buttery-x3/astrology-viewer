import { gunzipSync } from 'node:zlib';

const blockSize=512;
const decoder=new TextDecoder('utf-8',{fatal:true});
const text=(bytes:Uint8Array)=>decoder.decode(bytes.subarray(0,bytes.indexOf(0)<0?bytes.length:bytes.indexOf(0)));
function octal(bytes:Uint8Array):number{
  const value=text(bytes).trim();
  if(!/^[0-7]+$/.test(value))throw new Error('Invalid Git TAR numeric field.');
  const number=Number.parseInt(value,8);
  if(!Number.isSafeInteger(number)||number<0)throw new Error('Git TAR size exceeds its bound.');
  return number;
}
function paxPath(bytes:Uint8Array):string|undefined{
  if(bytes.length>64*1024)throw new Error('Git TAR extension exceeds its bound.');
  let offset=0,path:string|undefined;
  while(offset<bytes.length){
    const separator=bytes.indexOf(32,offset);
    if(separator<0)throw new Error('Malformed Git TAR extension.');
    const lengthText=decoder.decode(bytes.subarray(offset,separator));
    if(!/^[1-9]\d*$/.test(lengthText))throw new Error('Malformed Git TAR extension length.');
    const length=Number(lengthText),end=offset+length;
    if(!Number.isSafeInteger(length)||end>bytes.length||end<=separator+1||bytes[end-1]!==10)throw new Error('Malformed Git TAR extension bounds.');
    const record=decoder.decode(bytes.subarray(separator+1,end-1));
    if(record.startsWith('path='))path=record.slice(5);
    offset=end;
  }
  return path;
}

/** Read one regular text entry from Git's USTAR/PAX archive. Never extract paths. */
export function sourceArchiveText(gzip:Uint8Array,target:string,maxOutputBytes=256*1024*1024):string{
  const tar=gunzipSync(gzip,{maxOutputLength:maxOutputBytes});
  if(tar.length%blockSize!==0)throw new Error('Git TAR is not block aligned.');
  let offset=0,nextPath:string|undefined,found:string|undefined,ended=false;
  while(offset+blockSize<=tar.length){
    const header=tar.subarray(offset,offset+blockSize);
    if(header.every(byte=>byte===0)){
      if(tar.length-offset<2*blockSize||!tar.subarray(offset).every(byte=>byte===0))throw new Error('Malformed Git TAR ending.');
      ended=true;break;
    }
    const checksum=header.reduce((sum,byte,index)=>sum+(index>=148&&index<156?32:byte),0);
    if(checksum!==octal(header.subarray(148,156)))throw new Error('Git TAR header checksum mismatch.');
    const size=octal(header.subarray(124,136)),start=offset+blockSize,end=start+size;
    if(end>tar.length)throw new Error('Git TAR entry is truncated.');
    const type=header[156],body=tar.subarray(start,end);
    offset=start+Math.ceil(size/blockSize)*blockSize;
    if(type===120){nextPath=paxPath(body);continue;}
    if(type===103){if(paxPath(body)!==undefined)throw new Error('Global Git TAR paths are unsupported.');continue;}
    const prefix=text(header.subarray(345,500));
    const name=nextPath??`${prefix?`${prefix}/`:''}${text(header.subarray(0,100))}`;
    nextPath=undefined;
    if(!name||name.length>4096||name.startsWith('/')||name.includes('\\')||name.replace(/\/$/,'').split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Unsafe Git TAR path.');
    if(name===target){
      if(type!==0&&type!==48)throw new Error('Source identity must be a regular Git TAR file.');
      if(found!==undefined||size>128)throw new Error('Duplicate or oversized source identity.');
      found=decoder.decode(body);
    }
  }
  if(!ended||nextPath!==undefined)throw new Error('Git TAR archive is incomplete.');
  if(found===undefined)throw new Error('Source identity is absent from the archive.');
  return found;
}
