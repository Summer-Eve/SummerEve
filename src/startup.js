import {RESOURCE_VERSION,resourceCacheName,startupResources} from './startup-resources.js?v=20261003-r4';
import {loadResources} from './resource-loader.js?v=20261003-r4';
import {paintTown,settleTown} from './startup-town.js?v=20261003-r4';

const base=new URL('../',import.meta.url),screen=document.querySelector('#startup');
const bar=screen.querySelector('progress'),percent=screen.querySelector('[data-load-percent]');
const status=screen.querySelector('[data-load-status]'),note=screen.querySelector('[data-cache-note]');
const retry=screen.querySelector('[data-load-retry]'),enter=screen.querySelector('[data-load-enter]');
const town=screen.querySelector('.startup-town');
let cache=null,controlled=false,done=0,hits=0,pending=startupResources(),busy=false;
const total=pending.length;
async function enableCache(){
  try{if(globalThis.caches)cache=await caches.open(resourceCacheName(base));}catch{}
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
  paintTown(town,value);
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
  if(busy)return;
  busy=true;retry.hidden=true;enter.hidden=true;
  status.textContent=done===total?'资源已就绪，正在展卷':'正在进入游戏，未完成的资源将在使用时重试';
  try{
    await ensureStyles();
    await import('./app2.js?v=20261003-r4');
    if(done===total)await settleTown(town);
    document.documentElement.classList.remove('booting');screen.remove();
  }catch(error){
    console.error('Game startup failed',error);busy=false;
    status.textContent='游戏未能启动，请检查网络后重新加载。';
    retry.hidden=false;retry.textContent='重新加载';retry.onclick=()=>location.reload();
  }
}
async function run(){
  if(busy)return;
  busy=true;retry.hidden=true;enter.hidden=true;
  const offset=done,previousHits=hits;
  const controller=new AbortController();let earlyEntry=false;
  enter.disabled=false;enter.onclick=()=>{earlyEntry=true;enter.disabled=true;controller.abort();};
  const result=await loadResources(pending,{base,cache,signal:controller.signal,onProgress:p=>{
    enter.hidden=!p.requiredReady;
    paint(offset+p.loaded);
    status.textContent=`正在准备资源 ${offset+p.loaded} / ${total}`;
    note.textContent=p.cacheWritable&&controlled?'首次加载后可在此浏览器复用缓存':'正在预加载；当前浏览器可能无法保留资源缓存';
    if(previousHits+p.cached>0)note.textContent=`已从缓存读取 ${previousHits+p.cached} 项`+(p.cacheWritable&&controlled?'':' · 缓存功能受限');
  }});
  done+=result.loaded;hits+=result.cached;pending=result.failed;busy=false;
  if(earlyEntry){await startGame();return;}
  if(!pending.length){paint(total);status.textContent='资源加载完成';await startGame();return;}
  const critical=pending.some(item=>item.required);
  status.textContent=critical?`有 ${pending.length} 项资源未加载，重试后进入游戏`:`有 ${pending.length} 项资源未加载，可重试或先进入游戏`;
  note.textContent='已完成的资源会保留；重试只加载尚未完成的部分。';
  retry.hidden=false;retry.onclick=run;enter.hidden=critical;enter.onclick=startGame;
}
paint(0);await enableCache();await run();
