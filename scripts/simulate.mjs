import {newSave,draw,exchange,claimDaily,progress} from '../src/engine.js';
import {POOLS,RULES} from '../src/data.js';
const runs=Number(process.argv[2])||1000;
const rngFor=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const missing=(s,r)=>POOLS[r].filter(c=>(s.copies[c.id]||0)<c.max).sort((a,b)=>(s.copies[a.id]||0)-(s.copies[b.id]||0));
const days=[],completion14=[],ssr14=[];
for(let i=1;i<=runs;i++){
 const s=newSave(),rng=rngFor(i*73819);
 for(let day=1;day<=60;day++){
  const date=new Date(Date.UTC(2026,0,day)).toISOString().slice(0,10);claimDaily(s,date);
  while(s.tickets>0)draw(s,s.tickets>=10?10:1,rng);
  while(s.marks>=100){const c=missing(s,'SSR')[0];if(!c)break;exchange(s,c.id);}
  if(day>=14)for(const rarity of ['SR','R','N']){while(s.glow>=RULES.costs[rarity]){const c=missing(s,rarity)[0];if(!c)break;exchange(s,c.id);}}
  const p=progress(s);
  if(day===14){completion14.push(p.complete);ssr14.push(missing(s,'SSR').length===0);}
  if(p.complete){if(day<14)ssr14.push(true);days.push(day);break;}
  if(day===60)days.push(61);
 }
}
days.sort((a,b)=>a-b);
console.log(JSON.stringify({runs,seedRule:'run index * 73819, 32-bit LCG',strategy:'Spend all daily tickets. SSR marks exchanged daily, lowest owned first. Save glow until day14, then redeem SR, R, N missing copies after each daily draw.',completedBy14Percent:days.filter(d=>d<=14).length/runs*100,allSSRFullBy14Percent:ssr14.filter(Boolean).length/runs*100,completionDay:{min:days[0],p10:days[Math.floor(runs*.1)],median:days[Math.floor(runs*.5)],p90:days[Math.floor(runs*.9)],max:days.at(-1)}},null,2));
