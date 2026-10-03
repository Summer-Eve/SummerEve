// Result thumbnails load independently of the reveal animation and never redraw.
import {resourceActivity} from './resource-activity.js?v=20261004-r10';
export function watchResultImages(root) {
  const images=[...root.querySelectorAll('img[data-full-src]')];
  const status=root.querySelector('[data-image-status]');
  const retry=root.querySelector('[data-retry-images]');
  let release=resourceActivity.hold();const timers=new Map();
  const cleanup=()=>{for(const timer of timers.values())clearTimeout(timer);timers.clear();release?.();release=null;observer.disconnect();root.removeEventListener('close',closed);};
  const closed=()=>{if(!root.open)cleanup();};
  const observer=new MutationObserver(()=>{if(!images.some(img=>root.contains(img)))cleanup();});
  observer.observe(root,{childList:true,subtree:true});root.addEventListener('close',closed);
  const update=()=>{
    if(!root.contains(status))return;
    const failed=images.filter(img=>img.closest('.result-card').classList.contains('image-failed')).length;
    const pending=images.filter(img=>!img.closest('.result-card').classList.contains('image-ready')&&!img.closest('.result-card').classList.contains('image-failed')).length;
    status.hidden=!pending&&!failed;
    status.textContent=failed?`${failed}张卡面加载失败，点击重试（不消耗晷签）`:pending?`卡面载入中（${images.length-pending}/${images.length}）`:'';
    retry.hidden=!failed;
    if(!pending){release?.();release=null;}
  };
  for(const img of images){
    const card=img.closest('.result-card');
    const ready=async()=>{
      const source=img.src;
      try{if(img.decode)await img.decode();}catch{if(img.src===source){clearTimeout(timers.get(img));timers.delete(img);card.classList.add('image-failed');update();}return;}
      if(!root.contains(img)||img.src!==source||!img.complete||!img.naturalWidth)return;
      clearTimeout(timers.get(img));timers.delete(img);
      card.classList.remove('image-failed');card.classList.add('image-ready');update();
    };
    img.addEventListener('load',ready);
    img.addEventListener('error',()=>{
      if(img.dataset.fallback!=='1'){
        img.dataset.fallback='1';img.src=img.dataset.fullSrc;
      }else{clearTimeout(timers.get(img));timers.delete(img);card.classList.add('image-failed');update();}
    });
    const deadline=()=>{if(!root.contains(img)||card.classList.contains('image-ready'))return;card.classList.add('image-failed');update();};
    timers.set(img,setTimeout(deadline,20000));
    if(img.complete&&img.naturalWidth>0)ready();
  }
 // Retry only the request; do not invoke the modal's click-to-close handler.
 retry.addEventListener('click',event=>{
  event.stopPropagation();
    release??=resourceActivity.hold();
    for(const img of images){
      const card=img.closest('.result-card');
      if(!card.classList.contains('image-failed'))continue;
      card.classList.remove('image-failed');
      img.dataset.fallback='0';
      const url=new URL(img.dataset.previewSrc||img.dataset.fullSrc,img.ownerDocument.baseURI);
      url.searchParams.set('retry',Date.now());img.src=url.href;
      clearTimeout(timers.get(img));timers.set(img,setTimeout(()=>{if(root.contains(img)&&!card.classList.contains('image-ready')){card.classList.add('image-failed');update();}},20000));
    }
    update();
  });
  update();
}

// Only visible/near-visible gallery previews enter the network queue.
export function watchCollectionImages(root){
  const observers=[],releases=new Set(),timers=new Set();
  let stopped=false;
  const start=img=>{
    if(stopped||!img.dataset.previewSrc||img.dataset.requested)return;
    img.dataset.requested='1';const card=img.closest('.collection-card');
    const release=resourceActivity.hold();releases.add(release);
    const finish=()=>{release();releases.delete(release);};
    const timer=setTimeout(()=>{if(!card.classList.contains('image-ready'))card.classList.add('image-failed');finish();timers.delete(timer);},20000);timers.add(timer);
    img.onload=async()=>{try{await img.decode?.();if(!stopped){card.classList.remove('image-failed');card.classList.add('image-ready');}}catch{card.classList.add('image-failed');}clearTimeout(timer);timers.delete(timer);finish();};
    img.onerror=()=>{if(img.dataset.fallback!=='1'){img.dataset.fallback='1';img.src=img.dataset.fullSrc;}else{card.classList.add('image-failed');clearTimeout(timer);timers.delete(timer);finish();}};
    img.src=img.dataset.previewSrc;
  };
  const images=[...root.querySelectorAll('.collection-card img')];
  if(typeof IntersectionObserver==='function'){
    const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);start(entry.target.querySelector('img'));}},{root,rootMargin:'80px'});
    observers.push(observer);for(const img of images)observer.observe(img.closest('.collection-card'));
  }else for(const img of images)start(img);
  return ()=>{stopped=true;for(const observer of observers)observer.disconnect();for(const timer of timers)clearTimeout(timer);for(const release of releases)release();};
}
