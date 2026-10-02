// Result thumbnails load independently of the reveal animation and never redraw.
export function watchResultImages(root) {
  const images=[...root.querySelectorAll('img[data-full-src]')];
  const status=root.querySelector('[data-image-status]');
  const retry=root.querySelector('[data-retry-images]');
  const update=()=>{
    if(!root.contains(status))return;
    const failed=images.filter(img=>img.closest('.result-card').classList.contains('image-failed')).length;
    const pending=images.filter(img=>!img.closest('.result-card').classList.contains('image-ready')&&!img.closest('.result-card').classList.contains('image-failed')).length;
    status.hidden=!pending&&!failed;
    status.textContent=failed?`${failed}张卡面加载失败，点击重试（不消耗晷签）`:pending?`卡面载入中（${images.length-pending}/${images.length}）`:'';
    retry.hidden=!failed;
  };
  for(const img of images){
    const card=img.closest('.result-card');
    const ready=async()=>{
      try{if(img.decode)await img.decode();}catch{card.classList.add('image-failed');update();return;}
      if(!root.contains(img))return;
      card.classList.remove('image-failed');card.classList.add('image-ready');update();
    };
    img.addEventListener('load',ready);
    img.addEventListener('error',()=>{
      if(img.dataset.fallback!=='1'){
        img.dataset.fallback='1';img.src=img.dataset.fullSrc;
      }else{card.classList.add('image-failed');update();}
    });
    if(img.complete&&img.naturalWidth>0)ready();
  }
 // Retry only the request; do not invoke the modal's click-to-close handler.
 retry.addEventListener('click',event=>{
  event.stopPropagation();
    for(const img of images){
      const card=img.closest('.result-card');
      if(!card.classList.contains('image-failed'))continue;
      card.classList.remove('image-failed');
      img.dataset.fallback='1';
      const url=new URL(img.dataset.fullSrc,img.ownerDocument.baseURI);
      url.searchParams.set('retry',Date.now());img.src=url.href;
    }
    update();
  });
  update();
}
