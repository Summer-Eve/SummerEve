// Counts only fully read, successful responses. A failed file never advances progress.
export async function loadResources(resources,{base,cache=null,assetCache=null,fetcher=globalThis.fetch,concurrency=4,timeout=25000,signal,waitForTurn=async()=>{},validateResource=async()=>{},onProgress=()=>{}}={}){
  let cursor=0,loaded=0,cached=0,bytes=0,cacheWritable=Boolean(cache);
  const failed=[];
  let requiredLeft=resources.filter(resource=>resource.required).length;
  const report=()=>onProgress({loaded,total:resources.length,cached,bytes,cacheWritable,failed:failed.length,requiredReady:requiredLeft===0});
  report();
  async function one(resource){
    const url=new URL(resource.url,base).href;
    try{
      if(signal?.aborted)throw new Error('preload paused');
      let response;
      if(cache)try{response=await cache.match(url);}catch{cacheWritable=false;}
      let hit=Boolean(response?.ok);
      // Artwork is unchanged from compatible releases; never inherit old code.
      if(!hit&&assetCache&&resource.url.startsWith('./assets/'))try{
        response=await assetCache.match(url);hit=Boolean(response?.ok);
        if(hit&&cacheWritable)try{await cache.put(url,response.clone());}catch{cacheWritable=false;}
      }catch{}
      if(!hit){
        let lastError;
        for(let attempt=0;attempt<2;attempt++){
          const controller=new AbortController();
          const abort=()=>controller.abort();
          signal?.addEventListener('abort',abort,{once:true});
          if(signal?.aborted)controller.abort();
          const timer=setTimeout(()=>controller.abort(),timeout);
          try{
            response=await fetcher(url,{signal:controller.signal,cache:'default',priority:resource.required?'auto':'low',headers:{'X-Rigui-Preload':'1'}});
            if(!response.ok)throw new Error('HTTP '+response.status);
            // Keep the timeout active until the body has actually arrived.
            const body=await response.arrayBuffer();
            bytes+=body.byteLength;
            const headers=new Headers(response.headers);
            headers.delete('Content-Encoding');headers.delete('Transfer-Encoding');
            headers.set('Content-Length',String(body.byteLength));
            response=new Response(body,{status:response.status,headers});
            lastError=null;break;
          }catch(error){lastError=error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
          if(signal?.aborted)break;
        }
        if(lastError)throw lastError;
        if(cacheWritable)try{await cache.put(url,response.clone());}catch{cacheWritable=false;}
      }
      try{await validateResource(resource,url);}catch(error){if(cache)try{await cache.delete(url);}catch{}throw error;}
      if(hit)cached++;
      loaded++;if(resource.required)requiredLeft--;report();
    }catch(error){failed.push({...resource,error:String(error.message||error)});report();}
  }
  await Promise.all(Array.from({length:Math.min(concurrency,resources.length)},async()=>{
    while(cursor<resources.length){
      const resource=resources[cursor++];
      if(!resource.required)await waitForTurn();
      await one(resource);
    }
  }));
  return {loaded,total:resources.length,cached,bytes,cacheWritable,failed};
}

// Validate native image loading as well as bytes before exposing early entry.
// Keep only the current worker's image alive, rather than retaining all decoded cards.
export function verifyEntryImage(resource,url,{ImageClass=globalThis.Image,timeout=20000}={}){
  if(!resource.required||!url.endsWith('.webp'))return Promise.resolve();
  if(!ImageClass)return Promise.reject(new Error('Image decoder unavailable'));
  return new Promise((resolve,reject)=>{
    const image=new ImageClass();let settled=false;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;if(error){image.removeAttribute?.('src');reject(error);}else resolve();};
    const timer=setTimeout(()=>finish(new Error('Entry image timeout')),timeout);
    image.onload=async()=>{try{if(image.decode)await image.decode();if(!image.naturalWidth)throw new Error('Empty entry image');finish();}catch(error){finish(error);}};
    image.onerror=()=>finish(new Error('Entry image unavailable'));image.src=url;
  });
}
