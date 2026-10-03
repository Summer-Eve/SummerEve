import {RESOURCE_VERSION,resourceCacheName,startupResources} from './startup-resources.js?v=20261004-r9';
import {loadResources,verifyEntryImage} from './resource-loader.js?v=20261004-r9';
import {startTown} from './startup-town.js?v=20261004-r9';
import {resourceActivity} from './resource-activity.js?v=20261004-r9';

const base=new URL('../',import.meta.url),screen=document.querySelector('#startup');
const bar=screen.querySelector('progress'),percent=screen.querySelector('[data-load-percent]');
const status=screen.querySelector('[data-load-status]'),note=screen.querySelector('[data-cache-note]');
const retry=screen.querySelector('[data-load-retry]'),enter=screen.querySelector('[data-load-enter]');
const town=screen.querySelector('.startup-town');
const stopTown=startTown(town);
let cache=null,assetCache=null,controlled=false,done=0,hits=0,pending=startupResources();
let loading=false,starting=false,entered=false,entryFailed=false,requiredReady=false,backgroundRetried=false;
const total=pending.length;
async function enableCache(){
  try{if(globalThis.caches)cache=await caches.open(resourceCacheName(base));}catch{}
  try{const names=await caches.keys(),previous=[];for(const version of ['20261003-r8','20261003-r7']){const name='rigui-resources:'+base.pathname+':'+version;if(names.includes(name))previous.push(await caches.open(name));}if(previous.length)assetCache={match:async url=>{for(const old of previous){const response=await old.match(url);if(response?.ok)return response;}}};}catch{}
  if(!('serviceWorker' in navigator))return;
  // A bounded handshake lets browsers that deny registration still preload and enter.
  const handshake=(async()=>{
    const registration=await navigator.serviceWorker.register(new URL('sw.js?v='+RESOURCE_VERSION,base),{scope:base.pathname,updateViaCache:'none'});
    const worker=registration.installing||registration.waiting||registration.active;
    if(!worker)return false;
    const expected=new URL('sw.js?v='+RESOURCE_VERSION,base).href;
    if(navigator.serviceWorker.controller?.scriptURL===expected)return true;
    return await new Promise(resolve=>{
      const changed=()=>{if(navigator.serviceWorker.controller?.scriptURL===expected){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve(true);}};
      const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',changed);resolve(false);},3000);
      navigator.serviceWorker.addEventListener('controllerchange',changed);changed();
    });
  })().catch(()=>false);
  controlled=await Promise.race([handshake,new Promise(resolve=>setTimeout(()=>resolve(false),3500))]);
}
function paint(count){
  const value=Math.floor(count/total*100);
  bar.value=value;percent.textContent=value+'%';
}
async function ensureStyles(){
  await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].filter(link=>!link.sheet).map(link=>new Promise((resolve,reject)=>{
    const replacement=link.cloneNode();
    const timer=setTimeout(()=>reject(new Error('Stylesheet timeout')),10000);
    replacement.onload=()=>{clearTimeout(timer);resolve();};
    replacement.onerror=()=>{clearTimeout(timer);reject(new Error('Stylesheet unavailable'));};
    link.replaceWith(replacement);
  })));
}
async function startGame(){
  if(starting||entered||entryFailed||!requiredReady)return;
  starting=true;retry.hidden=true;enter.hidden=true;enter.disabled=true;
  status.textContent=done===total?'资源已就绪，正在展卷':'正在进入游戏，剩余资源将继续后台下载';
  try{
    await ensureStyles();
    await import('./app2.js?v=20261004-r9');
    entered=true;
    stopTown();
    document.documentElement.classList.remove('booting');screen.remove();
    resumeBackground();
  }catch(error){
    console.error('Game startup failed',error);entryFailed=true;
    status.textContent='游戏未能启动，请检查网络后重新加载。';
    retry.hidden=false;retry.textContent='重新加载';retry.onclick=()=>location.reload();
  }finally{starting=false;}
}
function resumeBackground(){
  // Keep the current queue alive; only retry missing files once after it finishes.
  if(!entered||loading||!pending.length||backgroundRetried)return;
  backgroundRetried=true;void run(true);
}
async function run(background=false){
  if(loading||entryFailed)return;
  loading=true;
  if(!entered){retry.hidden=true;enter.hidden=true;enter.disabled=false;enter.onclick=startGame;}
  const offset=done,previousHits=hits;
  // Core finishes first. Optional files use one slot and yield to visible images.
  const critical=pending.filter(item=>item.required),optional=pending.filter(item=>!item.required);
  let roundLoaded=0,roundHits=0;
  const report=p=>{
    requiredReady=p.requiredReady;
    if(entered||starting||entryFailed)return;
    enter.hidden=!requiredReady;
    paint(offset+roundLoaded+p.loaded);
    status.textContent=`正在准备资源 ${offset+roundLoaded+p.loaded} / ${total}`;
    note.textContent=p.cacheWritable&&controlled?'首次加载后可在此浏览器复用缓存':'正在预加载；当前浏览器可能无法保留资源缓存';
    if(previousHits+roundHits+p.cached>0)note.textContent=`已从缓存读取 ${previousHits+roundHits+p.cached} 项`+(p.cacheWritable&&controlled?'':' · 缓存功能受限');
  };
  const core=await loadResources(critical,{base,cache,assetCache,concurrency:4,validateResource:verifyEntryImage,onProgress:report});
  roundLoaded=core.loaded;roundHits=core.cached;
  // A failed core must not be reported ready by the optional-only phase.
  const rest=await loadResources(optional,{base,cache,assetCache,concurrency:1,waitForTurn:()=>resourceActivity.wait(),onProgress:p=>report({...p,requiredReady:!core.failed.length})});
  const result={loaded:core.loaded+rest.loaded,cached:core.cached+rest.cached,failed:[...core.failed,...rest.failed]};
  done+=result.loaded;hits+=result.cached;pending=result.failed;loading=false;
  if(entered){resumeBackground();return;}
  if(starting||entryFailed)return;
  if(!pending.length){paint(total);status.textContent='资源加载完成';await startGame();return;}
  const criticalMissing=pending.some(item=>item.required);
  status.textContent=criticalMissing?`有 ${pending.length} 项资源未加载，重试后进入游戏`:`有 ${pending.length} 项资源未加载，可重试或先进入游戏`;
  note.textContent='已完成的资源会保留；重试只加载尚未完成的部分。';
  retry.hidden=false;retry.onclick=()=>run();enter.hidden=criticalMissing;enter.onclick=startGame;
}
paint(0);await enableCache();await run();
