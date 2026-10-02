import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {CARDS} from '../src/data.js';
import {newSave,validateSave,draw} from '../src/engine.js';
import {drawArt,firstMeetingMarkup,drawSummary} from '../src/presentation.js';
import {starsMarkup} from '../src/presentation.js';

test('missing collection cards have five empty stars and a preview-only muted treatment',()=>{
 const source=readFileSync(new URL('../src/app2.js',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.ok(source.includes("n===0?' unowned':' owned'"));
 assert.match(styles,/\.collection-card\.unowned>img\{filter:grayscale\(\.72\) saturate\(\.65\);opacity:\.72\}/);
 for(const rarity of ['SSR','SR','R','N']){
  const html=starsMarkup(rarity,0);assert.equal((html.match(/class="star unlit"/g)||[]).length,5);assert.equal((html.match(/class="star lit"/g)||[]).length,0);
 }
});

test('first-meeting preference defaults on, survives import, migrates old saves',()=>{
 const save=newSave();assert.equal(save.settings.showNew,true);
 save.settings.showNew=false;assert.equal(validateSave(save).settings.showNew,false);
 delete save.settings.showNew;assert.equal(validateSave(save).settings.showNew,true);
 save.settings.showNew='false';assert.throws(()=>validateSave(save));
});
test('first-meeting only renders for a new card with the preference enabled',()=>{
 assert.match(firstMeetingMarkup({isNew:true},{showNew:true}),/first-meeting/);
 assert.equal(firstMeetingMarkup({isNew:true},{showNew:false}),'');
 assert.equal(firstMeetingMarkup({isNew:false},{showNew:true}),'');
});
test('ten-card overview contains SR without bonus cards and charges exactly ten',()=>{
 const save=newSave();let calls=0;
 const items=draw(save,10,()=>calls++<18?.9:0);
 assert.equal(items.length,10);assert.equal(items.filter(r=>r.bonus).length,0);
 assert.ok(items.some(r=>r.source==='SR保底'));
 assert.equal(save.tickets,50);assert.equal(save.marks,10);assert.equal(save.totalDraws,10);
 assert.equal(drawSummary(items,10),'消耗 10 晷签 · 获得 10 份 · 印记 +10');
 assert.equal(drawSummary([{bonus:false}],1),'消耗 1 晷签 · 获得 1 份 · 印记 +1');
});
test('all 95 approved artworks have lighter WebP draw previews',()=>{
 let full=0,thumb=0;
 for(const card of CARDS){
  const original=statSync(new URL('../'+card.art,import.meta.url)).size;
  const preview=new URL('../'+drawArt(card),import.meta.url),size=statSync(preview).size;
  const bytes=readFileSync(preview);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.ok(size<original,card.id);full+=original;thumb+=size;
 }
 assert.ok(thumb/full<.3);
});
test('every sliding ten-draw window contains SR, including unaligned ten-pulls',()=>{
 const save=newSave();save.tickets=1000;
 let seed=1234;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 const all=[];
 for(let n=0;n<100;n++){
  const items=draw(save,10,rng);assert.equal(items.length,10);assert.ok(items.every(r=>!r.bonus));all.push(...items);
 }
 for(let n=9;n<all.length;n++)assert.ok(all.slice(n-9,n+1).some(r=>CARDS.find(c=>c.id===r.id).rarity==='SR'));
 assert.equal(save.received,1000);assert.equal(save.totalDraws,1000);validateSave(save);
});
test('old supplemental cards remain owned and historic records remain readable',()=>{
 const save=newSave();delete save.srPity;const card=CARDS.find(c=>c.rarity==='SR');
 save.totalDraws=10;save.received=11;save.marks=10;save.copies[card.id]=1;
 save.history=[{id:card.id,source:'SR补发',bonus:true,isNew:true,before:0,after:1,glow:0,number:10,time:'2026-10-02T00:00:00Z'}];
 const migrated=validateSave(save);assert.equal(migrated.srPity,0);assert.equal(migrated.copies[card.id],1);assert.equal(migrated.received,11);assert.equal(migrated.history[0].bonus,true);
 const items=draw(migrated,10,()=>.9);assert.equal(items.length,10);assert.equal(migrated.received,21);
});
test('legacy collision honors its promised SSR then carries SR within the next ten paid slots',()=>{
 const old=newSave();delete old.srPity;old.pity=59;old.totalDraws=59;old.received=59;old.marks=59;
 const save=validateSave(old);assert.equal(save.srPity,9);
 const items=draw(save,10,()=>.9);assert.equal(items.length,10);assert.equal(items[0].source,'SSR保底');assert.equal(items[1].source,'SR保底');assert.equal(save.received,69);
});
