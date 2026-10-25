interface Bucket{tokens:number;updated:number}
export interface LookupLimits{perClientPerMinute:number;searchPerMinute:number;searchPerDay:number;maxClients:number}
/** Process-memory limits contain only transient network identities and counters, never chart/query data. */
export function createLookupLimiter(limits:LookupLimits,now:()=>number=Date.now){
  const clients=new Map<string,Bucket>(),global:Bucket={tokens:limits.searchPerMinute,updated:now()};let day=Math.floor(now()/86400000),daily=0,lastSweep=now();
  function refill(bucket:Bucket,capacity:number,time:number){bucket.tokens=Math.min(capacity,bucket.tokens+Math.max(0,time-bucket.updated)*capacity/60000);bucket.updated=time;}
  return{
    consume(identity:string,search:boolean):{allowed:boolean;retryAfter:number}{
      const time=now(),today=Math.floor(time/86400000);if(today!==day){day=today;daily=0;}
      if(time-lastSweep>=60000){for(const [key,bucket]of clients)if(time-bucket.updated>=60000)clients.delete(key);lastSweep=time;}
      // Expire inactive identities before admitting a new one. If still full,
      // refuse admission instead of evicting active limits for an attacker.
      if(!clients.has(identity)&&clients.size>=limits.maxClients){for(const [key,bucket]of clients)if(time-bucket.updated>=60000)clients.delete(key);if(clients.size>=limits.maxClients)return{allowed:false,retryAfter:60};}
      const local=clients.get(identity)??{tokens:limits.perClientPerMinute,updated:time};refill(local,limits.perClientPerMinute,time);clients.set(identity,local);refill(global,limits.searchPerMinute,time);
      const cost=search?3:1;
      let retryAfter=local.tokens>=cost?0:Math.ceil((cost-local.tokens)*60/limits.perClientPerMinute);
      if(search){if(global.tokens<1)retryAfter=Math.max(retryAfter,Math.ceil((1-global.tokens)*60/limits.searchPerMinute));if(daily>=limits.searchPerDay)retryAfter=Math.max(retryAfter,Math.ceil(((today+1)*86400000-time)/1000));}
      if(retryAfter)return{allowed:false,retryAfter:Math.max(1,retryAfter)};
      local.tokens-=cost;if(search){global.tokens--;daily++;}return{allowed:true,retryAfter:0};
    },
    get size(){return clients.size;},
  };
}
