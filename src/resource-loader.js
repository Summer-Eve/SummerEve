// Counts only fully read, successful responses. A failed file never advances progress.
export async function loadResources(resources,{base,cache=null,fetcher=globalThis.fetch,concurrency=4,timeout=25000,signal,onProgress=()=>{}}={}){
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
      if(!hit){
        let lastError;
        for(let attempt=0;attempt<2;attempt++){
          const controller=new AbortController();
          const abort=()=>controller.abort();
          signal?.addEventListener('abort',abort,{once:true});
          if(signal?.aborted)controller.abort();
          const timer=setTimeout(()=>controller.abort(),timeout);
          try{
            response=await fetcher(url,{signal:controller.signal,cache:'no-cache',headers:{'X-Rigui-Preload':'1'}});
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
      }else cached++;
      loaded++;if(resource.required)requiredLeft--;report();
    }catch(error){failed.push({...resource,error:String(error.message||error)});report();}
  }
  await Promise.all(Array.from({length:Math.min(concurrency,resources.length)},async()=>{
    while(cursor<resources.length)await one(resources[cursor++]);
  }));
  return {loaded,total:resources.length,cached,bytes,cacheWritable,failed};
}
