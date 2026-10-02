import {newSave,draw,exchange,claimDaily,progress} from '../src/engine.js';
import {POOLS,RULES,TOTAL_COPIES} from '../src/data.js';

const runs=Number(process.argv[2])||1000;
if(!Number.isSafeInteger(runs)||runs<1||runs>100000)throw new Error('Runs must be an integer from 1 to 100000.');
const rngFor=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const missing=(s,r)=>POOLS[r].filter(c=>(s.copies[c.id]||0)<c.max).sort((a,b)=>(s.copies[a.id]||0)-(s.copies[b.id]||0));
const quantile=(sorted,p)=>sorted[Math.floor((sorted.length-1)*p)];
const summarize=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted.length?{min:sorted[0],p10:quantile(sorted,.1),median:quantile(sorted,.5),p90:quantile(sorted,.9),p99:quantile(sorted,.99),max:sorted.at(-1),mean:Math.round(sorted.reduce((a,b)=>a+b,0)/sorted.length)}:null;
};

function simulate(withExchange){
  const draws=[],days=[];
  let completedBy14=0,ssrFullBy14=0,incomplete=0;
  for(let i=1;i<=runs;i++){
    const s=newSave(),rng=rngFor(i*73819);
    let finished=false;
    for(let day=1;day<=365;day++){
      const date=new Date(Date.UTC(2026,0,day)).toISOString().slice(0,10);
      claimDaily(s,date);
      const redeem=()=>{
        if(!withExchange)return;
        while(s.marks>=RULES.exchange){const c=missing(s,'SSR')[0];if(!c)break;exchange(s,c.id);}
        if(day>=14)for(const rarity of ['SR','R','N']){
          while(s.glow>=RULES.costs[rarity]){const c=missing(s,rarity)[0];if(!c)break;exchange(s,c.id);}
        }
      };
      redeem();
      while(s.tickets>0&&!progress(s).complete){draw(s,1,rng);redeem();}
      const p=progress(s);
      if(day===14||p.complete){
        if(day<=14&&p.complete)completedBy14++;
        if(day<=14&&missing(s,'SSR').length===0)ssrFullBy14++;
      }
      if(p.complete){draws.push(s.totalDraws);days.push(day);finished=true;break;}
    }
    if(!finished)incomplete++;
  }
  return {withExchange,completed:runs-incomplete,incomplete,completedBy14Percent:completedBy14/runs*100,allSSRFullBy14Percent:ssrFullBy14/runs*100,completionDraws:summarize(draws),completionDay:summarize(days)};
}

console.log(JSON.stringify({runs,effectiveCopies:TOTAL_COPIES,seedRule:'run index * 73819, 32-bit LCG',assumptions:'Daily gifts unchanged; spend all tickets. With exchange: use marks on least-owned SSR after each draw, save glow until day 14, then redeem missing SR, R, N in that order. Stop at the first fully completed draw.',results:[simulate(true),simulate(false)]},null,2));
