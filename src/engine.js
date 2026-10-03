import { CARDS, CARD_BY_ID, POOLS, RARITIES, RULES, TOTAL_COPIES } from './data.js?v=20261003-r7';

const LEGACY_CAPS = { SSR: 3, SR: 5, R: 8, N: 10 };

export const DEFAULT_SETTINGS = Object.freeze({ fast: false, reduced: false, rareEffects: true, showNew: true, sound: true, music: true, effects: true, volume: .35 });
export function newSave() {
  return { version: 1, tickets: RULES.firstGift, totalDraws: 0, pity: 0, srPity: 0, blockHasSR: false,
    marks: 0, glow: 0, copies: {}, days: 0, lastClaim: '', history: [], received: 0,
    settings: {...DEFAULT_SETTINGS}, createdAt: new Date().toISOString(), welcomed: false };
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function progress(s) {
  let owned=0, full=0, copies=0;
  for(const c of CARDS) {const n=s.copies[c.id]||0; owned+=Number(n>0); full+=Number(n>=c.max); copies+=Math.min(n,c.max);}
  return {owned,full,copies,total:CARDS.length,max:TOTAL_COPIES,complete:full===CARDS.length};
}
export function rewardForDay(day) { return RULES.daily + (RULES.milestones[day] || 0); }
export function claimDaily(s, day=localDay()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('日期无效');
  if(s.lastClaim && day<=s.lastClaim) throw new Error('今天的签赠已领取，请明日再来。');
  if(progress(s).complete) throw new Error('百卷已成，签赠旅程已完成。');
  s.days++; s.lastClaim=day; const amount=rewardForDay(s.days); s.tickets+=amount; return amount;
}
function randomValue(rng) {const x=rng();if(!Number.isFinite(x)||x<0||x>=1)throw new Error('随机数无效');return x;}
export function selectCard(s,rarity,rng=Math.random) {
  const pool=POOLS[rarity];
  const weight=c=>(s.copies[c.id]||0)>=c.max?RULES.fullWeight:RULES.normalWeight;
  let value=randomValue(rng)*pool.reduce((sum,c)=>sum+weight(c),0);
  for(const c of pool) {value-=weight(c);if(value<0)return c;}
  return pool.at(-1);
}
function grant(s,card,source,bonus=false) {
  const before=s.copies[card.id]||0; const overflow=before>=card.max;
  const glow=overflow?RULES.overflow[card.rarity]:0;
  if(overflow) s.glow+=glow; else s.copies[card.id]=before+1;
  s.received++;
  const result={id:card.id,source,bonus,isNew:before===0,before,after:Math.min(before+1,card.max),glow,number:s.totalDraws,time:new Date().toISOString()};
  s.history.unshift(result); if(s.history.length>300)s.history.length=300;
  return result;
}
export function draw(s,count=1,rng=Math.random) {
  if(![1,10].includes(count))throw new Error('仅支持单抽或十连');
  if(s.tickets<count)throw new Error('晷签不足，可领取今日签赠。');
  const results=[];
  for(let i=0;i<count;i++) {
    let rarity; const hard=s.pity===RULES.pity-1;
    // Reserve the ninth SR-counter slot only if the next draw hits SSR hard pity.
    // That lets both guarantees fit inside ten actual draws, never an extra grant.
    const reserveSR=s.srPity===8&&s.pity===RULES.pity-2;
    const needSR=s.srPity===9||reserveSR;
    if(hard)rarity='SSR'; else {
      const roll=randomValue(rng); let threshold=0;
      rarity=RARITIES.find(r=>{threshold+=RULES.rates[r];return roll<threshold;})||'N';
    }
    s.tickets--;s.totalDraws++;s.marks++;
    const blockEnd=s.totalDraws%10===0;
    let source=hard?'SSR保底':'抽取';
    if(needSR&&!hard&&rarity!=='SR'){rarity='SR';source='SR保底';}
    s.pity=rarity==='SSR'?0:s.pity+1;
    // Legacy saves may already sit at both boundaries: honor SSR, then SR on
    // the next paid slot. Old cards/history are never removed or rewritten.
    s.srPity=rarity==='SR'?0:Math.min(9,s.srPity+1);
    if(rarity==='SR')s.blockHasSR=true;
    results.push(grant(s,selectCard(s,rarity,rng),source));
    if(blockEnd)s.blockHasSR=false;
  }
  return results;
}
export function exchange(s,id) {
  const c=CARD_BY_ID[id]; if(!c)throw new Error('卡牌不存在');
  if((s.copies[id]||0)>=c.max)throw new Error('此卷已满星，请选择尚未满星的卡牌。');
  const currency=c.rarity==='SSR'?'marks':'glow';
  const cost=c.rarity==='SSR'?RULES.exchange:RULES.costs[c.rarity];
  if(s[currency]<cost){const label=currency==='marks'?'印记':'余晖';throw new Error(`${label}余额不足，还需 ${cost-s[currency]} ${label}。`);}
  s[currency]-=cost;return grant(s,c,'定向兑换');
}
export function validateSave(raw) {
  const fail=()=>{throw new Error('存档格式不完整或版本不兼容，现有存档未更改。');};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))fail();
  const s=raw.format==='rigui-save'?raw.save:raw;
  if(!s||s.version!==1)fail();
  const number=(k,max=1e9)=>{if(!Number.isSafeInteger(s[k])||s[k]<0||s[k]>max)fail();return s[k];};
  const base=newSave();
  for(const k of ['tickets','totalDraws','marks','glow','days','received'])base[k]=number(k);
  base.pity=number('pity',59); if(base.pity>base.totalDraws||base.marks>base.totalDraws||base.received<base.totalDraws)fail();
  if(typeof s.blockHasSR!=='boolean'||(s.totalDraws%10===0&&s.blockHasSR))fail();base.blockHasSR=s.blockHasSR;
  if(typeof s.lastClaim!=='string'||(s.lastClaim!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(s.lastClaim)))fail();
  if((s.days===0)!==(s.lastClaim===''))fail();
  if(s.lastClaim){const date=new Date(s.lastClaim+'T12:00:00');if(!Number.isFinite(+date)||localDay(date)!==s.lastClaim)fail();}base.lastClaim=s.lastClaim;
  if(!s.copies||typeof s.copies!=='object'||Array.isArray(s.copies))fail();base.copies={};
  for(const [id,n] of Object.entries(s.copies)){
    const card=CARD_BY_ID[id];
    if(!card||!Number.isSafeInteger(n)||n<0||n>Math.max(card.max,LEGACY_CAPS[card.rarity]))fail();
    base.copies[id]=Math.min(n,card.max);
    base.glow+=(n-base.copies[id])*RULES.overflow[card.rarity];
  }
  if(!Number.isSafeInteger(base.glow)||base.glow>1e9)fail();
  if(!s.settings||typeof s.settings!=='object')fail();
  for(const k of ['fast','reduced','rareEffects','sound']){if(typeof s.settings[k]!=='boolean')fail();base.settings[k]=s.settings[k];}
  for(const k of ['music','effects','showNew']){if(s.settings[k]!==undefined&&typeof s.settings[k]!=='boolean')fail();base.settings[k]=s.settings[k]??true;}
  if(typeof s.settings.volume!=='number'||!Number.isFinite(s.settings.volume)||s.settings.volume<0||s.settings.volume>1)fail();base.settings.volume=s.settings.volume;
  if(!Array.isArray(s.history)||s.history.length>300)fail();
  base.history=s.history.map(h=>{
    if(!h||!Object.hasOwn(CARD_BY_ID,h.id)||!['抽取','SSR保底','SR保底','SR补发','定向兑换'].includes(h.source)||typeof h.time!=='string'||!Number.isFinite(Date.parse(h.time)))fail();
    if(typeof h.bonus!=='boolean'||typeof h.isNew!=='boolean')fail();
    for(const k of ['before','after','glow','number'])if(!Number.isSafeInteger(h[k])||h[k]<0)fail();
    const historicalMax=Math.max(CARD_BY_ID[h.id].max,LEGACY_CAPS[CARD_BY_ID[h.id].rarity]);
    if(h.before>historicalMax||h.after>historicalMax||h.number>s.totalDraws||h.glow>20)fail();
    return {id:h.id,source:h.source,time:h.time,bonus:h.bonus,isNew:h.isNew,before:h.before,after:h.after,glow:h.glow,number:h.number};
  });
  if(s.srPity!==undefined){base.srPity=number('srPity',9);if(base.srPity>base.totalDraws)fail();}
  else {
    const lastSR=base.history.filter(h=>CARD_BY_ID[h.id].rarity==='SR'&&h.source!=='定向兑换').reduce((latest,h)=>Math.max(latest,h.number),-1);
    base.srPity=Math.min(9,lastSR<0?base.totalDraws%10:base.totalDraws-lastSR);
  }
  base.createdAt=typeof s.createdAt==='string'&&Number.isFinite(Date.parse(s.createdAt))?s.createdAt:base.createdAt;
  base.welcomed=Boolean(s.welcomed);
  return base;
}
