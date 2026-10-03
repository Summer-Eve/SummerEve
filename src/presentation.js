import {RULES} from './data.js?v=20261004-r10';

export function pityCopy(pity) {
  return {ssr:`${RULES.pity-pity}抽内可获得SSR`,sr:'每10抽必出SR',shared:'单抽与十连均享有保底'};
}

export function collectionPercent({copies,max}) {
  if (!max) return '0.00';
  return (Math.min(max,Math.max(0,copies))/max*100).toFixed(2);
}

export const drawArt=card=>card.art.replace('./assets/','./assets/draw/');

export function collectionFilterChoices(key,characters){
  const groups={
    rarity:{label:'稀有度',options:[['all','全部'],['SSR','SSR'],['SR','SR'],['R','R'],['N','N']]},
    role:{label:'人物',options:[['all','全部人物'],...characters.map(c=>[c.id,c.name])]},
    owned:{label:'收集',options:[['all','全部状态'],['missing','未获得'],['owned','已获得'],['unfinished','未满星'],['full','已满星']]}
  };
  return groups[key];
}
export function collectionFilterButton(key,value,characters){
  const group=collectionFilterChoices(key,characters),label=group.options.find(option=>option[0]===value)?.[1]||group.options[0][1];
  return `<label>${group.label}<button type="button" class="collection-filter-button" data-open-filter="${key}" aria-label="${group.label}：${label}" aria-haspopup="dialog">${label}<span aria-hidden="true">⌄</span></button></label>`;
}
export function collectionFilterMarkup(key,value,characters){
  const group=collectionFilterChoices(key,characters);
  return `<header class="modal-head"><h2>${group.label}</h2><button data-close>关闭 ×</button></header><div class="filter-options" role="group" aria-label="${group.label}">${group.options.map(([id,label])=>`<button type="button" data-filter-key="${key}" data-filter-option="${id}" aria-pressed="${id===value}">${label}</button>`).join('')}</div>`;
}
// Explicit dimensions avoid percentage-height/aspect-ratio feedback in WebKit.
export function resultCardSize(width,height,count){
  const rows=count===1?1:2,columns=count===1?1:5,gap=count===1?0:8;
  const cardHeight=Math.max(0,Math.floor(Math.min((height-gap*(rows-1))/rows,(width/columns-20)*1.5)));
  return {width:Math.floor(cardHeight*2/3),height:cardHeight};
}
export function fitResultCards(root){
  const grid=root.querySelector('.draw-results');
  if(!grid)return;
  let frame;
  const fit=()=>{if(!root.open||!root.contains(grid))return;const size=resultCardSize(grid.clientWidth,grid.clientHeight,grid.children.length);root.style.setProperty('--result-card-width',size.width+'px');root.style.setProperty('--result-card-height',size.height+'px');};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  observer?.observe(grid);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);schedule();
  const cleanup=()=>{observer?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);root.removeEventListener('close',closed);};
  const closed=()=>{if(!root.open||!root.contains(grid))cleanup();};root.addEventListener('close',closed);
  return cleanup;
}
export function firstMeetingMarkup(result,settings) {
  return result.isNew&&settings.showNew!==false?'<em class="first-meeting" aria-label="初见">初见</em>':'';
}
export function drawSummary(items,count) {
  return `消耗 ${count} 晷签 · 获得 ${items.length} 份 · 印记 +${count}`;
}

export function starsMarkup(rarity,owned) {
  const max=RULES.caps[rarity];
  const count=Math.min(max,Math.max(0,Math.floor(owned)));
  const star='<path d="M12 2.4 14.9 8.5 21.6 9.4 16.8 14.1 17.9 20.8 12 17.6 6.1 20.8 7.2 14.1 2.4 9.4 9.1 8.5Z"/>';
  const columns=Math.min(max,5);
  return `<span class="star-rating ${rarity}" role="img" aria-label="${count}/${max}星" style="--star-cols:${columns}">${Array.from({length:max},(_,i)=>`<svg class="star ${i<count?'lit':'unlit'}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${star}</svg>`).join('')}</span>`;
}
