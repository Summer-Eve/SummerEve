import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadResources} from '../src/resource-loader.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check){for(let i=0;i<100;i++){if(check())return;await tick();}assert.fail('Condition did not settle');}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function boot(fetcher,importGame=async()=>{}){
 const elements=new Map();
 for(const name of ['progress','[data-load-percent]','[data-load-status]','[data-cache-note]','[data-load-retry]','[data-load-enter]','.startup-town'])elements.set(name,{hidden:true,disabled:false,textContent:'',value:0});
 let removed=0,stopped=0,imports=0;
 const cached=new Map(),screen={querySelector:name=>elements.get(name),remove:()=>{removed++;}};
 const document={querySelector:()=>screen,querySelectorAll:()=>[],documentElement:{classList:{remove(){}}}};
 const resources=[{url:'core',required:true},{url:'slow-a'},{url:'slow-b'}];
 let source=readFileSync(new URL('../src/startup.js',import.meta.url),'utf8');
 source=source.replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',JSON.stringify('https://example.test/src/startup.js'));
 source=source.replace(/import\('\.\/app2\.js\?v=[^']+'\)/,'importGame()');
 const completion=vm.runInNewContext('(async()=>{'+source+'})()',{
  URL,setTimeout,clearTimeout,navigator:{},console:{error(){}},document,location:{reload(){}},
  RESOURCE_VERSION:'test',resourceCacheName:()=> 'test',startupResources:()=>resources,
  resourceActivity:{wait:async()=>{}},
  caches:{open:async()=>({match:async key=>cached.get(key)?.clone(),put:async(key,response)=>{cached.set(key,response);}})},
  startTown:()=>()=>{stopped++;},loadResources:(list,options)=>loadResources(list,{...options,fetcher}),
  importGame:async()=>{imports++;await importGame();}
 });
 return {completion,elements,cached,get removed(){return removed;},get stopped(){return stopped;},get imports(){return imports;}};
}

test('early entry opens the game once while unfinished downloads continue and populate cache',async()=>{
 const gate=deferred(),importGate=deferred(),requests=[];
 const session=boot(async url=>{requests.push(url);if(!url.endsWith('core'))await gate.promise;return new Response('ok');},()=>importGate.promise);
 const enter=session.elements.get('[data-load-enter]');await until(()=>!enter.hidden);
 enter.onclick();enter.onclick();await until(()=>session.imports===1);
 assert.equal(session.removed,0);importGate.resolve();await until(()=>session.removed===1);
 assert.equal(session.stopped,1);assert.equal(session.cached.size,1);
 gate.resolve();await session.completion;await until(()=>session.cached.size===3);
 assert.equal(requests.length,3);assert.equal(session.imports,1);assert.equal(session.removed,1);
});
test('missing optional files retry in the background without repeating completed files',async()=>{
 const requests=[];let failed=0;
 const session=boot(async url=>{requests.push(url);if(url.endsWith('slow-b')&&failed++<2)return new Response('no',{status:503});return new Response('ok');});
 await session.completion;
 assert.equal(session.removed,0);assert.equal(session.elements.get('progress').value,66);
 await session.elements.get('[data-load-enter]').onclick();await until(()=>session.cached.size===3);
 assert.equal(requests.filter(url=>url.endsWith('core')).length,1);
 assert.equal(requests.filter(url=>url.endsWith('slow-a')).length,1);
 assert.equal(requests.filter(url=>url.endsWith('slow-b')).length,3);
});
test('persistent background failures have a bounded retry count and do not reopen the loader',async()=>{
 let failures=0;
 const session=boot(async url=>url.endsWith('slow-b')?(failures++,new Response('no',{status:503})):new Response('ok'));
 await session.completion;await session.elements.get('[data-load-enter]').onclick();await until(()=>failures===4);
 await tick();assert.equal(failures,4);assert.equal(session.removed,1);assert.equal(session.cached.size,2);
});
test('required failure blocks entry even if its handler is called directly',async()=>{
 const session=boot(async url=>new Response('body',{status:url.endsWith('core')?503:200}));
 await session.completion;assert.equal(session.elements.get('[data-load-enter]').hidden,true);
 await session.elements.get('[data-load-enter]').onclick();assert.equal(session.imports,0);assert.equal(session.removed,0);
});
test('a failed game import stays visible and cannot be overwritten by background progress',async()=>{
 const gate=deferred();
 const session=boot(async url=>{if(!url.endsWith('core'))await gate.promise;return new Response('ok');},async()=>{throw new Error('import failed');});
 const enter=session.elements.get('[data-load-enter]');await until(()=>!enter.hidden);await enter.onclick();
 const status=session.elements.get('[data-load-status]');assert.match(status.textContent,/游戏未能启动/);
 gate.resolve();await session.completion;assert.match(status.textContent,/游戏未能启动/);
 assert.equal(session.elements.get('[data-load-retry]').textContent,'重新加载');assert.equal(session.removed,0);
});
