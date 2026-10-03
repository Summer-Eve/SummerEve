import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CARDS} from '../src/data.js';
import {newSave,exchange} from '../src/engine.js';
import {exchangeSuccessMarkup,watchExchangeImage} from '../src/exchange-feedback.js';

test('iPhone layout update keeps draw controls and exchange feedback separate',()=>{
 const source=readFileSync(new URL('../src/app2.js',import.meta.url),'utf8'),drawMarkup=source.split(/\r?\n/).find(line=>line.startsWith('function showResults'));
 assert.match(drawMarkup,/firstMeetingMarkup\(r,state.settings\)/);
 assert.match(drawMarkup,/starsMarkup\(c.rarity,r.after\)/);
 assert.match(drawMarkup,/drawSummary\(items,count\)/);
 assert.match(drawMarkup,/result-actions.*data-image-status.*data-retry-images.*data-redraw/);
 assert.doesNotMatch(drawMarkup,/data-exchange|兑换成功/);
});

test('insufficient exchange names the currency and exact shortfall without changing progress',()=>{
 for(const [rarity,balance,shortfall,currency] of [['SSR',73,27,'印记'],['SR',17,63,'余晖'],['R',11,19,'余晖'],['N',0,10,'余晖']]){
  const state=newSave(),card=CARDS.find(c=>c.rarity===rarity);state[rarity==='SSR'?'marks':'glow']=balance;
  const before=structuredClone(state);
  assert.throws(()=>exchange(state,card.id),{message:`${currency}余额不足，还需 ${shortfall} ${currency}。`});
  assert.deepEqual(state,before);
 }
});
test('exchange grants one copy and charges only its own currency, never a draw',()=>{
 for(const [rarity,cost] of [['SSR',100],['SR',80],['R',30],['N',10]]){
  const state=newSave(),card=CARDS.find(c=>c.rarity===rarity);state.marks=200;state.glow=200;state.pity=7;state.srPity=4;
  const result=exchange(state,card.id);
  assert.equal(state.marks,rarity==='SSR'?200-cost:200);assert.equal(state.glow,rarity==='SSR'?200:200-cost);
  assert.equal(state.copies[card.id],1);assert.equal(state.received,1);assert.equal(state.history.length,1);assert.equal(result.source,'定向兑换');
  assert.equal(state.tickets,60);assert.equal(state.totalDraws,0);assert.equal(state.pity,7);assert.equal(state.srPity,4);
  const markup=exchangeSuccessMarkup(card,result);
  assert.ok(markup.includes('兑换成功'));assert.ok(markup.includes('点击任意位置关闭'));assert.ok(markup.includes(card.art));assert.ok(markup.includes(card.displayName+' · '+card.title));
  assert.equal((markup.match(/class="star lit"/g)||[]).length,1);assert.equal((markup.match(/class="star unlit"/g)||[]).length,4);
  assert.ok(!markup.includes('data-redraw'));assert.ok(!markup.includes('data-exchange='));
 }
});
test('supplied exchange cue is preserved byte-for-byte and has a short PCM playback window',()=>{
 const b=readFileSync(new URL('../assets/audio/exchange-success-v1.wav',import.meta.url));
 assert.equal(createHash('sha256').update(b).digest('hex'),'620b7e13f8e57737b23768a58a432a0dd527564ec760c7b6e8499f768b2d67fc');
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
 let p=12,byteRate=0,size=0;
 while(p+8<=b.length){const name=b.toString('ascii',p,p+4),n=b.readUInt32LE(p+4);if(name==='fmt ')byteRate=b.readUInt32LE(p+16);if(name==='data')size=n;p+=8+n+(n%2);}
 assert.ok(size/byteRate>.4&&size/byteRate<.5);
});

test('an old image decode cannot hide the retry control after a newer request failed',async()=>{
 let resolve;const listeners={},img={src:'original.webp',complete:false,naturalWidth:100,decode:()=>new Promise(r=>resolve=r),addEventListener:(type,fn)=>listeners[type]=fn};
 const status={hidden:false,textContent:''},retry={hidden:true,addEventListener(){}};
 const root={contains:()=>true,querySelector:selector=>selector==='img'?img:selector==='[data-exchange-image-status]'?status:retry};
 watchExchangeImage(root);const pending=listeners.load();img.src='failed.webp';img.complete=true;img.naturalWidth=0;listeners.error();
 resolve();await pending;assert.equal(retry.hidden,false);assert.equal(status.hidden,false);assert.ok(status.textContent.includes('重试不会再次扣费'));
});
