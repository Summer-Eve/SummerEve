import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../src/data.js';
import {startupResources} from '../src/startup-resources.js';
import {verifyEntryImage,loadResources} from '../src/resource-loader.js';

test('entry requires all 95 draw previews, five homepage originals and the two scene surfaces',()=>{
 const list=startupResources(),byUrl=new Map(list.map(r=>[r.url,r]));
 assert.equal(list.length,218);assert.equal(list.filter(r=>r.required).length,121);
 for(const card of CARDS){assert.equal(byUrl.get(card.art.replace('./assets/','./assets/draw/')).required,true);assert.equal(byUrl.get(card.art).required,card.rarity==='SSR');}
 for(const file of ['palace-bg-v2.webp','scroll-reveal.webp'])assert.equal(byUrl.get('./assets/'+file).required,true);
 assert.ok(list.filter(r=>r.url.endsWith('.wav')).every(r=>!r.required));
});

test('entry image readiness includes successful native decoding, not just a download',async()=>{
 let release;const decoded=new Promise(resolve=>release=resolve),images=[];
 class Image {naturalWidth=480;constructor(){images.push(this);}set src(value){this.url=value;queueMicrotask(()=>this.onload());}decode(){return decoded;}}
 let ready=false;const pending=verifyEntryImage({required:true},'https://example.test/card.webp',{ImageClass:Image}).then(()=>ready=true);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(ready,false);release();await pending;assert.equal(ready,true);
 assert.equal(images[0].onload,null);assert.equal(images[0].onerror,null);
});

test('entry image rejects load errors, invalid decode, empty pixels and timeout',async()=>{
 class Failed {set src(value){queueMicrotask(()=>this.onerror());}}
 class Invalid {naturalWidth=480;set src(value){queueMicrotask(()=>this.onload());}decode(){return Promise.reject(Error('invalid image'));}}
 class Empty {naturalWidth=0;set src(value){queueMicrotask(()=>this.onload());}}
 class Stalled {set src(value){}removeAttribute(){this.cancelled=true;}}
 for(const ImageClass of [Failed,Invalid,Empty,Stalled])await assert.rejects(verifyEntryImage({required:true},'https://example.test/card.webp',{ImageClass,timeout:10}));
 await verifyEntryImage({required:false},'https://example.test/optional.webp',{ImageClass:Failed});
 await verifyEntryImage({required:true},'https://example.test/program.js',{ImageClass:Failed});
});

test('a cached file whose pixels fail validation cannot enable entry or advance progress',async()=>{
 const map=new Map([['https://example.test/card.webp',new Response('invalid')]]),progress=[];
 const result=await loadResources([{url:'card.webp',required:true}],{base:'https://example.test/',cache:{match:async url=>map.get(url),delete:async url=>map.delete(url)},validateResource:async()=>{throw Error('invalid pixels');},onProgress:p=>progress.push(p)});
 assert.equal(result.loaded,0);assert.equal(result.cached,0);assert.equal(result.failed.length,1);
 assert.equal(progress.at(-1).requiredReady,false);assert.equal(map.size,0);
});
