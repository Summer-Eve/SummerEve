import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installPageScroll} from '../src/page-scroll.js';
import {collectionFilterChoices,collectionFilterButton,collectionFilterMarkup} from '../src/presentation.js';
import {CHARACTERS} from '../src/data.js';
import {startupResources} from '../src/startup-resources.js';

function harness({rotated=false,editable=false,reduced=true}={}){
 const handlers=new Map(),windowHandlers=new Map(),frames=new Map();let time=0,next=0;
 const page={scrollTop:0,scrollHeight:1000,clientHeight:300,isConnected:true,contains:target=>target===targetNode};
 const targetNode={closest:selector=>selector.startsWith('input')?(editable?targetNode:null):page};
 const window={performance:{now:()=>time},matchMedia:()=>({matches:reduced}),requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id),addEventListener:(type,handler)=>windowHandlers.set(type,handler),removeEventListener:type=>windowHandlers.delete(type)};
 const root={ownerDocument:{defaultView:window,documentElement:{classList:{contains:()=>rotated}}},contains:()=>true,addEventListener:(type,handler,options)=>handlers.set(type,{handler,options}),removeEventListener:type=>handlers.delete(type)};
 const dispose=installPageScroll(root);
 function event(type,x=100,y=200,count=1){time+=16;const e={target:targetNode,cancelable:true,touches:Array.from({length:count},(_,i)=>({identifier:i,clientX:x,clientY:y})),prevented:false,preventDefault(){this.prevented=true;}};handlers.get(type).handler(e);return e;}
 return {page,root,handlers,windowHandlers,frames,dispose,event,targetNode,advance:ms=>time+=ms};
}
test('native-landscape touch drag scrolls the list, clamps bounds, and ignores short taps',()=>{
 const h=harness();h.event('touchstart');assert.equal(h.event('touchmove',101,197).prevented,false);assert.equal(h.page.scrollTop,0);
 assert.equal(h.event('touchmove',100,20).prevented,true);assert.equal(h.page.scrollTop,180);
 h.event('touchmove',100,-900);assert.equal(h.page.scrollTop,700);h.event('touchmove',100,1000);assert.equal(h.page.scrollTop,0);h.dispose();
});
test('rotated pages support both game-axis and physical-screen vertical gestures',()=>{
 const h=harness({rotated:true});h.event('touchstart');h.event('touchmove',280,200);assert.equal(h.page.scrollTop,180);h.event('touchend');
 h.page.scrollTop=0;h.event('touchstart');h.event('touchmove',100,20);assert.equal(h.page.scrollTop,180);h.dispose();
});
test('form controls, multitouch, cancellation and page removal never hijack a gesture',()=>{
 const input=harness({editable:true});input.event('touchstart');assert.equal(input.event('touchmove',100,20).prevented,false);assert.equal(input.page.scrollTop,0);
 const h=harness();h.event('touchstart');h.event('touchmove',100,20,2);assert.equal(h.event('touchmove',100,10).prevented,false);
 h.event('touchstart');h.event('touchcancel');assert.equal(h.event('touchmove',100,10).prevented,false);
 h.event('touchstart');h.page.isConnected=false;assert.equal(h.event('touchmove',100,10).prevented,false);input.dispose();h.dispose();
});
test('drag clicks are suppressed but keyboard activation and the next deliberate tap work',()=>{
 const h=harness();h.event('touchstart');h.event('touchmove',100,20);h.event('touchend');
 const click=detail=>({detail,target:h.targetNode,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
 const keyboard=click(0);h.handlers.get('click').handler(keyboard);assert.equal(keyboard.prevented,false);
 const stray=click(1);h.handlers.get('click').handler(stray);assert.ok(stray.prevented&&stray.stopped);
 h.event('touchstart');h.event('touchend');const tap=click(1);h.handlers.get('click').handler(tap);assert.equal(tap.prevented,false);h.dispose();
});
test('momentum is bounded and resize/disposal release listeners and pending frames',()=>{
 const h=harness({reduced:false});h.event('touchstart');h.event('touchmove',100,160);h.event('touchend');assert.equal(h.frames.size,1);
 h.windowHandlers.get('resize')();assert.equal(h.frames.size,0);
 h.event('touchstart');h.event('touchmove',100,120);h.event('touchend');h.dispose();assert.equal(h.frames.size,0);assert.equal(h.handlers.size,0);assert.equal(h.windowHandlers.size,0);
});
test('touch scroll is required before entry and is not installed on the startup screen or detail dialog',()=>{
 const css=readFileSync(new URL('../src/browser-compat.css',import.meta.url),'utf8'),app=readFileSync(new URL('../src/app2.js',import.meta.url),'utf8');
 assert.ok(startupResources().some(r=>r.required&&r.url.includes('/page-scroll.js?v=')));
 assert.match(app,/installPageScroll\(app\)/);assert.match(css,/touch-action:pinch-zoom/);assert.doesNotMatch(css,/touch-action:none/);
});
test('momentum stops within its time limit and never exceeds list bounds',()=>{
 const h=harness({reduced:false});h.event('touchstart');h.event('touchmove',100,20);h.event('touchend');let ticks=0;
 while(h.frames.size){const [id,callback]=h.frames.entries().next().value;h.frames.delete(id);h.advance(16);callback(h.root.ownerDocument.defaultView.performance.now());assert.ok(h.page.scrollTop>=0&&h.page.scrollTop<=700);assert.ok(++ticks<=51);}
 assert.ok(h.page.scrollTop>180);h.dispose();
});
test('all filter choices preserve existing keys and names and use web buttons rather than native selects',()=>{
 assert.deepEqual(collectionFilterChoices('rarity',CHARACTERS).options.map(x=>x[0]),['all','SSR','SR','R','N']);
 assert.deepEqual(collectionFilterChoices('role',CHARACTERS).options.slice(1).map(x=>x[1]),CHARACTERS.map(c=>c.name));
 assert.deepEqual(collectionFilterChoices('owned',CHARACTERS).options.map(x=>x[0]),['all','missing','owned','unfinished','full']);
 assert.equal(collectionFilterChoices('invalid',CHARACTERS),undefined);
 for(const key of ['rarity','role','owned']){const button=collectionFilterButton(key,'all',CHARACTERS),markup=collectionFilterMarkup(key,'all',CHARACTERS);assert.match(button,/aria-haspopup="dialog"/);assert.match(markup,/aria-pressed="true"/);assert.doesNotMatch(button+markup,/<select|<option/);}
 assert.doesNotMatch(readFileSync(new URL('../src/app2.js',import.meta.url),'utf8'),/<select data-filter/);
});
