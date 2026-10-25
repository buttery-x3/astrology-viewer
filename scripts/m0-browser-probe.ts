const worker = new Worker(new URL('../src/lib/workers/ephemeris-worker.ts',import.meta.url),{type:'module'});
let revision=0;
function request(message:Record<string,unknown>):Promise<Record<string,any>> {
  const current=++revision;
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Worker probe timed out.')),20000);
    const listener=(event:MessageEvent)=>{
      if(event.data.revision!==current)return;
      clearTimeout(timeout);worker.removeEventListener('message',listener);
      if(event.data.type==='error')reject(new Error(event.data.error));else resolve(event.data);
    };
    worker.addEventListener('message',listener);worker.postMessage({...message,revision:current});
  });
}
async function run(){
  const start=performance.now();
  const ready=await request({type:'init'});
  const coldStartMs=performance.now()-start;
  const samples:number[]=[];let last:Record<string,any>={};
  for(let i=0;i<250;i++){
    last=await request({type:'calculate',instantMs:Date.UTC(2000,0,1,12)+i*86400000,observer:{latitudeDeg:51.5,longitudeDeg:0}});
    samples.push(last.calculationMs);
  }
  const polar=await request({type:'calculate',instantMs:Date.UTC(2000,0,1,12),observer:{latitudeDeg:80,longitudeDeg:0}});
  const sorted=[...samples].sort((a,b)=>a-b);
  const report={browser:navigator.userAgent,worker:true,engine:ready.version,coldStartMs,batchCount:samples.length,
    medianCalculationMs:sorted[Math.floor(sorted.length/2)],p95CalculationMs:sorted[Math.floor(sorted.length*.95)],
    wasmHeapBytes:last.heapBytes,bodyCount:last.snapshot.bodies.length,houseCount:last.snapshot.houses.length,
    polarStatuses:polar.snapshot.houses.map((h:any)=>({system:h.system,status:h.status})),
    memoryMethod:'Allocated WASM linear memory; excludes browser/JS/GPU peak memory.'};
  worker.terminate();document.getElementById('output')!.textContent=JSON.stringify(report,null,2);
  (window as any).m0Report=report;
}
run().catch(error=>{(window as any).m0Error=String(error);document.getElementById('output')!.textContent=String(error);worker.terminate();});
