import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GameAudio} from '../src/audio.js';
import {newSave,validateSave} from '../src/engine.js';

class Context {
 currentTime=0;destination={};sources=[];
 createGain(){return {gain:{value:0,cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}},connect(){}};}
 createBufferSource(){const s={connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};this.sources.push(s);return s;}
 resume(){this.running=true;return Promise.resolve();} suspend(){this.running=false;return Promise.resolve();}
 decodeAudioData(bytes){return Promise.resolve({bytes});}
}
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(fetcher=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})){
 const settings={sound:true,music:true,effects:true,volume:.35};return {settings,audio:new GameAudio(()=>settings,{Context,fetcher})};
}
test('repeated gestures keep one loop and mute stops all sources',async()=>{
 const {audio,settings}=setup();await audio.unlock();await tick();await audio.unlock();
 assert.equal(audio.ctx.sources.filter(s=>s.loop&&s.started).length,1);
 await audio.playPages();assert.equal(audio.effects.size,1);assert.equal(audio.musicGain.gain.value,.12);
 settings.sound=false;audio.sync();assert.equal(audio.effects.size,0);assert.equal(audio.music,null);assert.equal(audio.master.gain.value,0);
});
test('skip cancels a page sound still downloading; close replaces pages once',async()=>{
 let release;const {audio}=setup(async url=>({ok:true,arrayBuffer:()=>String(url).includes('pages')?new Promise(r=>release=r):Promise.resolve(new ArrayBuffer(8))}));
 const pages=audio.playPages();await tick();audio.stopPages();release(new ArrayBuffer(8));await pages;
 assert.equal(audio.effects.size,0);
 await audio.playPages();const prior=audio.effects.get('pages');await audio.playClose();
 assert.equal(prior.stopped,true);assert.deepEqual([...audio.effects.keys()],['wood']);
});
test('independent music/effect switches and hidden tab suspend playback',async()=>{
 const {audio,settings}=setup();settings.music=false;await audio.playPages();assert.equal(audio.music,null);assert.ok(audio.effects.has('pages'));
 await audio.setHidden(true);assert.equal(audio.ctx.running,false);assert.equal(audio.effects.size,0);
 settings.effects=false;await audio.setHidden(false);await audio.playClose();assert.equal(audio.effects.size,0);
});
test('older saves gain audio switches without losing volume or mute',()=>{
 const save=newSave();delete save.settings.music;delete save.settings.effects;save.settings.sound=false;save.settings.volume=.17;
 const imported=validateSave(save);assert.equal(imported.settings.music,true);assert.equal(imported.settings.effects,true);assert.equal(imported.settings.sound,false);assert.equal(imported.settings.volume,.17);
});
test('opening and closing use the supplied reference cues, while music stays unchanged',async()=>{
 const requested=[];
 const {audio}=setup(async url=>{requested.push(String(url));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};});
 await audio.unlock();await tick();await audio.playPages();await audio.playClose();
 assert.ok(requested.some(url=>url.endsWith('/courtyard-story-v1.wav')));
 assert.ok(requested.some(url=>url.endsWith('/pages-turn-v3.wav')));
 assert.ok(requested.some(url=>url.endsWith('/scroll-wood-v3.wav')));
});
test('local PCM sound assets have requested durations and non-clipped audio',async()=>{
 for(const [file,minSeconds,maxSeconds] of [['courtyard-story-v1.wav',72,72],['pages-turn-v3.wav',2,3],['scroll-wood-v3.wav',1,1]]){
  const b=await readFile(new URL('../assets/audio/'+file,import.meta.url));assert.equal(b.toString('ascii',0,4),'RIFF');
  const seconds=b.readUInt32LE(40)/b.readUInt32LE(28);
  assert.ok(seconds>=minSeconds&&seconds<=maxSeconds,`${file}: ${seconds}s`);
  let peak=0;for(let i=44;i<b.length;i+=2)peak=Math.max(peak,Math.abs(b.readInt16LE(i)));
  assert.ok(peak>1000&&peak<32767);
 }
});
