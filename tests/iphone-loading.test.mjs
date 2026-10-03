import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resultCardSize} from '../src/presentation.js';
import {createResourceActivity} from '../src/resource-activity.js';
import {loadResources} from '../src/resource-loader.js';
import {startupResources} from '../src/startup-resources.js';

test('fixed ten-card dimensions reserve captions in the reduced-height canvas',()=>{
 const size=resultCardSize(680,180,10);assert.deepEqual(size,{width:57,height:86});
 assert.ok(size.width*5<=680&&size.height*2+8<=180);
 assert.deepEqual(resultCardSize(600,200,1),{width:133,height:200});
 assert.deepEqual(resultCardSize(0,0,10),{width:0,height:0});
});
test('foreground priority releases idempotently and waits for every active group',async()=>{
 const activity=createResourceActivity(),a=activity.hold(),b=activity.hold();let settled=false;
 const waiting=activity.wait().then(()=>settled=true);await Promise.resolve();assert.equal(settled,false);
 a();a();await Promise.resolve();assert.equal(activity.active,1);assert.equal(settled,false);
 b();await waiting;assert.equal(activity.active,0);assert.equal(settled,true);
 await activity.wait();
});
test('background starts no new download until visible images release their slot',async()=>{
 const activity=createResourceActivity(),release=activity.hold(),seen=[];
 const pending=loadResources([{url:'./assets/a.webp'},{url:'./assets/b.webp'}],{base:'https://example.test/',concurrency:1,waitForTurn:()=>activity.wait(),fetcher:async url=>{seen.push(url);return new Response('ok');}});
 await new Promise(r=>setImmediate(r));assert.equal(seen.length,0);release();
 const result=await pending;assert.equal(result.loaded,2);assert.equal(seen.length,2);
});
test('gallery requests previews on intersection; full art remains in details',()=>{
 const app=readFileSync(new URL('../src/app2.js',import.meta.url),'utf8');
 const gallery=app.split(/\r?\n/).find(x=>x.startsWith('function collection()'));
 const detail=app.split(/\r?\n/).find(x=>x.startsWith('function showDetail('));
 assert.match(gallery,/data-preview-src="'\+drawArt\(c\)/);assert.doesNotMatch(gallery,/<img src=/);
 assert.match(detail,/<img src="'\+c.art/);
 const watcher=readFileSync(new URL('../src/result-images.js',import.meta.url),'utf8');
 assert.match(watcher,/new IntersectionObserver/);assert.match(watcher,/rootMargin:'80px'/);assert.match(watcher,/20000/);
});
test('all previews precede original art in optional preload order',()=>{
 const list=startupResources();const lastPreview=Math.max(...list.map((r,i)=>r.url.includes('/assets/draw/')?i:-1));
 const firstFull=list.findIndex(r=>r.url.startsWith('./assets/ssr-'));
 assert.ok(lastPreview>=0&&firstFull>lastPreview);assert.equal(list.filter(r=>r.url.includes('/assets/draw/')).length,95);
});
