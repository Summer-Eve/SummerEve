import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {loadResources} from '../src/resource-loader.js';
import {startupResources,resourceCacheName,RESOURCE_VERSION} from '../src/startup-resources.js';
import {CARDS} from '../src/data.js';

const base='https://example.test/SummerEve/';
function fakeCache(){
 const map=new Map();
 return {map,match:async key=>map.get(String(key))?.clone(),put:async(key,response)=>{map.set(String(key),response);}};
}
test('startup manifest contains all approved originals, thumbnails and existing audio, and no duplicate paths',()=>{
 const resources=startupResources();
 assert.equal(new Set(resources.map(r=>r.url)).size,resources.length);
 for(const card of CARDS)for(const url of [card.art,card.art.replace('./assets/','./assets/draw/')])assert.ok(resources.some(r=>r.url===url));
 for(const resource of resources)assert.ok(existsSync(new URL('../'+resource.url.split('?')[0],import.meta.url)),resource.url);
 const audio=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
 for(const resource of resources.filter(r=>r.url.endsWith('.wav')))assert.ok(audio.includes(resource.url.split('/').pop()));
 assert.notEqual(resourceCacheName(base),resourceCacheName('https://example.test/OtherGame/'));
 assert.ok(resourceCacheName(base).endsWith(RESOURCE_VERSION));
});
test('real body completion and cache writes advance progress; warm run skips all downloads',async()=>{
 const cache=fakeCache(),resources=[{url:'a'},{url:'b'},{url:'c'}],progress=[];
 let calls=0;
 const fetcher=async()=>{calls++;return new Response('resource');};
 const first=await loadResources(resources,{base,cache,fetcher,onProgress:p=>progress.push(p.loaded)});
 assert.deepEqual(progress,[0,1,2,3]);assert.equal(first.bytes,24);assert.equal(first.cached,0);assert.equal(calls,3);
 const warm=await loadResources(resources,{base,cache,fetcher});
 assert.equal(warm.cached,3);assert.equal(warm.bytes,0);assert.equal(calls,3);
});
test('failed resources retry once without fake completion; a later retry only requests missing files',async()=>{
 const resources=[{url:'a',required:true},{url:'b',required:false}],seen=[];
 const first=await loadResources(resources,{base,fetcher:async url=>{seen.push(url);return new Response('x',{status:url.endsWith('b')?503:200});}});
 assert.equal(first.loaded,1);assert.equal(first.failed.length,1);assert.equal(first.failed[0].required,false);
 assert.equal(seen.filter(url=>url.endsWith('b')).length,2);
 seen.length=0;
 const second=await loadResources(first.failed,{base,fetcher:async url=>{seen.push(url);return new Response('ok');}});
 assert.equal(second.loaded,1);assert.deepEqual(seen,[base+'b']);
});
test('cached decoded bodies use their real length and do not retain transport compression headers',async()=>{
 const cache=fakeCache();
 const result=await loadResources([{url:'compressed'}],{base,cache,fetcher:async()=>new Response('decoded resource',{headers:{'Content-Encoding':'gzip','Transfer-Encoding':'chunked','Content-Length':'7','Content-Type':'text/plain'}})});
 assert.equal(result.loaded,1);
 const stored=await cache.match(base+'compressed');
 assert.equal(stored.headers.get('Content-Encoding'),null);
 assert.equal(stored.headers.get('Transfer-Encoding'),null);
 assert.equal(stored.headers.get('Content-Length'),'16');
 assert.equal(stored.headers.get('Content-Type'),'text/plain');
 assert.equal(await stored.text(),'decoded resource');
});
test('cache denied or full still preloads from network',async()=>{
 const cache={match:async()=>{throw new Error('denied');},put:async()=>{throw new Error('quota');}};
 const result=await loadResources([{url:'a'}],{base,cache,fetcher:async()=>new Response('ok')});
 assert.equal(result.loaded,1);assert.equal(result.cacheWritable,false);assert.equal(result.failed.length,0);
 const full=await loadResources([{url:'a'}],{base,cache:{match:async()=>undefined,put:cache.put},fetcher:async()=>new Response('ok')});
 assert.equal(full.loaded,1);assert.equal(full.cacheWritable,false);
});
test('explicit cancellation aborts unfinished preloads without counting them as complete',async()=>{
 const controller=new AbortController(),progress=[];
 const result=await loadResources([{url:'core',required:true},{url:'slow'},{url:'later'}],{base,signal:controller.signal,concurrency:1,
  fetcher:async url=>new Response(url),onProgress:p=>{progress.push(p);if(p.requiredReady)controller.abort();}
 });
 assert.equal(result.loaded,1);assert.equal(result.failed.length,2);
 assert.equal(progress.at(-1).requiredReady,true);
});
test('bounded concurrency and timeout include a stalled response body',async()=>{
 let active=0,max=0;
 await loadResources(Array.from({length:12},(_,i)=>({url:String(i)})),{base,concurrency:3,fetcher:async()=>{
  active++;max=Math.max(active,max);await new Promise(resolve=>setTimeout(resolve,2));active--;return new Response('ok');
 }});
 assert.equal(max,3);
 const result=await loadResources([{url:'stalled',required:true}],{base,timeout:10,fetcher:async(url,{signal})=>({ok:true,status:200,headers:{},arrayBuffer:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))})});
 assert.equal(result.loaded,0);assert.equal(result.failed[0].required,true);
});
function workerHarness(cache){
 const handlers={},requests=[];
 const self={location:{href:base+'sw.js?v='+RESOURCE_VERSION},addEventListener:(name,handler)=>{handlers[name]=handler;}};
 vm.runInNewContext(readFileSync(new URL('../sw.js',import.meta.url),'utf8'),{self,URL,Response,Headers,caches:{open:async()=>cache},fetch:async request=>{requests.push(request);return new Response('network');}});
 const fetch=async(url,headers={})=>{let result;handlers.fetch({request:new Request(new URL(url,base),{headers}),respondWith:promise=>{result=promise;}});return result?await result:null;};
 return {fetch,requests};
}
test('worker intercepts native images and serves proper audio byte ranges from the populated cache',async()=>{
 const cache=fakeCache();await cache.put(base+'assets/card.webp',new Response('image'));
 await cache.put(base+'assets/audio/sound.wav',new Response('0123456789',{headers:{'Content-Type':'audio/wav'}}));
 const worker=workerHarness(cache);
 assert.equal(await (await worker.fetch('assets/card.webp')).text(),'image');
 const audio=await worker.fetch('assets/audio/sound.wav',{Range:'bytes=2-5'});
 assert.equal(audio.status,206);assert.equal(audio.headers.get('Content-Range'),'bytes 2-5/10');assert.equal(await audio.text(),'2345');
 assert.equal((await worker.fetch('assets/audio/sound.wav',{Range:'bytes=20-'})).status,416);
 assert.equal(worker.requests.length,0);
});
test('worker never intercepts saves, navigation, another project, preload requests or other release code',async()=>{
 const worker=workerHarness(fakeCache());
 for(const url of ['index.html','https://example.test/OtherGame/assets/card.webp','src/app2.js?v=future','save.json'])assert.equal(await worker.fetch(url),null);
 assert.equal(await worker.fetch('assets/card.webp',{'X-Rigui-Preload':'1'}),null);
 const current=await worker.fetch('src/app2.js?v='+RESOURCE_VERSION);assert.equal(await current.text(),'network');
});
test('explicit image retry bypasses and repairs canonical cache; errors and partial responses stay uncached',async()=>{
 const cache=fakeCache();await cache.put(base+'assets/card.webp',new Response('old'));
 const worker=workerHarness(cache);
 assert.equal(await (await worker.fetch('assets/card.webp?retry=123')).text(),'network');
 assert.equal(await (await worker.fetch('assets/card.webp')).text(),'network');assert.equal(worker.requests.length,1);
});
test('startup remains isolated from save and economy; pavilion clip and bottom progress start at zero',()=>{
 const startup=readFileSync(new URL('../src/startup.js',import.meta.url),'utf8');
 assert.doesNotMatch(startup,/localStorage|newSave|draw\(|exchange\(/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/<progress max="100" value="0"/);assert.match(html,/id="town-ground"/);
 assert.match(startup,/paint\(0\)/);assert.match(startup,/paint\(total\)/);
 assert.ok(html.includes('data-load-enter'));
});
