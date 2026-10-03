import {starsMarkup} from './presentation.js?v=20261003-r5';

export function exchangeSuccessMarkup(card,result){
  return '<h2 class="exchange-heading" tabindex="-1">兑换成功</h2><article class="exchange-card '+card.rarity+'"><img src="'+card.art+'" alt="'+card.displayName+'·'+card.title+'" decoding="async"><span class="exchange-rarity">'+card.rarity+'</span><span class="exchange-image-status" role="status" data-exchange-image-status>卡面载入中…</span><button type="button" data-exchange-retry hidden>重试卡面</button></article><footer class="exchange-caption"><p class="exchange-name">'+card.displayName+' · '+card.title+'</p>'+starsMarkup(card.rarity,result.after)+'<p class="exchange-state">已收入图鉴 · 获得一份</p><p class="exchange-dismiss">点击任意位置关闭</p></footer>';
}

// Only retry the image. The exchange has already been persisted exactly once.
export function watchExchangeImage(root){
  const img=root.querySelector('img'),status=root.querySelector('[data-exchange-image-status]'),retry=root.querySelector('[data-exchange-retry]');
  const ready=async()=>{
    const source=img.src;
    try{if(img.decode)await img.decode();}catch{if(source===img.src)failed();return;}
    if(!root.contains(img)||source!==img.src||!img.complete||!img.naturalWidth)return;
    status.hidden=true;retry.hidden=true;
  };
  const failed=()=>{if(!root.contains(img))return;status.hidden=false;status.textContent='卡面加载失败，重试不会再次扣费';retry.hidden=false;};
  img.addEventListener('load',ready);img.addEventListener('error',failed);
  retry.addEventListener('click',event=>{
    event.stopPropagation();status.hidden=false;status.textContent='卡面载入中…';retry.hidden=true;
    const url=new URL(img.getAttribute('src'),img.ownerDocument.baseURI);url.searchParams.set('retry',Date.now());img.src=url.href;
  });
  if(img.complete){if(img.naturalWidth)ready();else failed();}
}

export function showExchangeError(root,message){
  root.querySelector('[data-exchange-feedback]')?.remove();
  const notice=root.ownerDocument.createElement('div');notice.className='exchange-notice';notice.dataset.exchangeFeedback='';notice.setAttribute('role','alert');notice.textContent=message;root.append(notice);
}
