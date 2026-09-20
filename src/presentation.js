import {RULES} from './data.js';

export function pityCopy(pity) {
  return {ssr:`${RULES.pity-pity}抽内可获得SSR`,sr:'每10抽必出SR',shared:'单抽与十连均享有保底'};
}

export function starsMarkup(rarity,owned) {
  const max=RULES.caps[rarity];
  const count=Math.min(max,Math.max(0,Math.floor(owned)));
  const star='<path d="M12 2.4 14.9 8.5 21.6 9.4 16.8 14.1 17.9 20.8 12 17.6 6.1 20.8 7.2 14.1 2.4 9.4 9.1 8.5Z"/>';
  const columns=rarity==='R'?4:Math.min(max,5);
  return `<span class="star-rating ${rarity}" role="img" aria-label="${count}/${max}星" style="--star-cols:${columns}">${Array.from({length:max},(_,i)=>`<svg class="star ${i<count?'lit':'unlit'}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${star}</svg>`).join('')}</span>`;
}
