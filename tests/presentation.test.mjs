import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pityCopy,starsMarkup} from '../src/presentation.js';

const appSource=readFileSync(new URL('../src/app2.js',import.meta.url),'utf8');

test('pity text stays dynamic and uses approved exact wording',()=>{
 assert.deepEqual(pityCopy(41),{ssr:'19抽内可获得SSR',sr:'每10抽必出SR',shared:'单抽与十连均享有保底'});
 assert.equal(pityCopy(0).ssr,'60抽内可获得SSR');assert.equal(pityCopy(59).ssr,'1抽内可获得SSR');
});
for(const [rarity,max] of Object.entries({SSR:3,SR:5,R:8,N:10})){
 test(`${rarity} renders correct total, lit and empty stars`,()=>{
  for(const count of [0,1,max]){const html=starsMarkup(rarity,count);assert.equal((html.match(/<svg /g)||[]).length,max);assert.equal((html.match(/class="star lit"/g)||[]).length,count);assert.equal((html.match(/class="star unlit"/g)||[]).length,max-count);assert.ok(html.includes(`aria-label="${count}/${max}星"`));assert.ok(html.includes(`--star-cols:${rarity==='R'?4:Math.min(max,5)}`));}
 });
}

test('rules copy preserves rates, guarantees and exchange boundaries',()=>{
 for(const text of ['SSR 1.5%、SR 3.5%、R 25%、N 70%。','SSR最多60抽获得。','每十抽至少获得一张SR','十连中出现的SSR不能替代保底SR','100印记可兑换任意未满星SSR卡一张','余晖可兑换N、R、SR卡'])assert.ok(appSource.includes(text));
});

test('home wallet exposes all balances and tooltip descriptions',()=>{
 for(const text of ['home-wallet','用于展卷的珍贵道具','每一次展卷可获取一个，满100个可兑换SSR','满星卡溢出时获得的稀有道具，可用于兑换卡面'])assert.ok(appSource.includes(text));
});
