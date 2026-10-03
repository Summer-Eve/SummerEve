/* Scoped resource cache only. Saves remain in localStorage and are never touched. */
const VERSION='20261003-r8';
const BASE=new URL('./',self.location.href);
const CACHE='rigui-resources:'+BASE.pathname+':'+VERSION;
// Only unchanged r7 assets can migrate; versioned programs always use r8.
const PREVIOUS_ASSETS='rigui-resources:'+BASE.pathname+':20261003-r7';
const pendingResources=new Map();
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function cachedResource(request,url){
  try{
    const cache=await caches.open(CACHE);
    // Explicit retry bypasses the cached image and repairs its canonical entry.
    const retry=url.searchParams.has('retry');
    if(retry)url.searchParams.delete('retry');
    const key=url.href;
    let cached=retry?null:await cache.match(key);
    if(!cached&&!retry&&url.pathname.startsWith(BASE.pathname+'assets/'))try{
      if((await caches.keys()).includes(PREVIOUS_ASSETS))cached=await (await caches.open(PREVIOUS_ASSETS)).match(key);
      if(cached)await cache.put(key,cached.clone());
    }catch{}
    if(cached){
      const range=request.headers.get('Range');
      if(!range)return cached;
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!match)return fetch(request);
      const body=await cached.arrayBuffer(),size=body.byteLength;
      const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
      const end=match[1]&&match[2]?Math.min(Number(match[2]),size-1):size-1;
      if(start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
      const headers=new Headers(cached.headers);
      headers.set('Content-Range',`bytes ${start}-${end}/${size}`);
      headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
      return new Response(body.slice(start,end+1),{status:206,headers});
    }
    const download=async()=>{
      const response=await fetch(request);
      // Partial audio, errors and opaque responses cannot populate a full-file cache.
      if(response.status===200)try{await cache.put(key,response.clone());}catch{}
      return response;
    };
    if(retry||request.headers.has('Range'))return await download();
    // A visible card and its preloader share one full-file request and body.
    if(!pendingResources.has(key))pendingResources.set(key,download().finally(()=>pendingResources.delete(key)));
    return (await pendingResources.get(key)).clone();
  }catch{return fetch(request);}
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const relative=url.pathname.slice(BASE.pathname.length);
  const asset=relative.startsWith('assets/')&&/\.(webp|svg|wav)$/.test(relative);
  // An older worker must not serve scripts/styles belonging to a newer release.
  const code=relative.startsWith('src/')&&/\.(js|css)$/.test(relative)&&url.searchParams.get('v')===VERSION;
  if(asset||code)event.respondWith(cachedResource(request,url));
});
