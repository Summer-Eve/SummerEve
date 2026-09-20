import test from 'node:test';
import assert from 'node:assert/strict';
import {pityCopy,starsMarkup} from '../src/presentation.js';

test('pity text stays dynamic and uses approved exact wording',()=>{
 assert.deepEqual(pityCopy(41),{ssr:'19抽内可获得SSR',sr:'每10抽必出SR',shared:'单抽与十连均享有保底'});
 assert.equal(pityCopy(0).ssr,'60抽内可获得SSR');assert.equal(pityCopy(59).ssr,'1抽内可获得SSR');
});
for(const [rarity,max] of Object.entries({SSR:3,SR:5,R:8,N:10})){
 test(`${rarity} renders correct total, lit and empty stars`,()=>{
  for(const count of [0,1,max]){const html=starsMarkup(rarity,count);assert.equal((html.match(/<svg /g)||[]).length,max);assert.equal((html.match(/class="star lit"/g)||[]).length,count);assert.equal((html.match(/class="star unlit"/g)||[]).length,max-count);assert.ok(html.includes(`aria-label="${count}/${max}星"`));assert.ok(html.includes(`--star-cols:${rarity==='R'?4:Math.min(max,5)}`));}
 });
}
