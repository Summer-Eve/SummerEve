import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pityCopy,starsMarkup} from '../src/presentation.js';

const appSource=readFileSync(new URL('../src/app2.js',import.meta.url),'utf8');
const indexSource=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const styleSource=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('pity text stays dynamic and uses approved exact wording',()=>{
 assert.deepEqual(pityCopy(41),{ssr:'19抽内可获得SSR',sr:'每10抽必出SR',shared:'单抽与十连均享有保底'});
 assert.equal(pityCopy(0).ssr,'60抽内可获得SSR');assert.equal(pityCopy(59).ssr,'1抽内可获得SSR');
});

test('local review builds refill tickets without affecting the hosted game',()=>{
 assert.match(appSource,/\['localhost','127\.0\.0\.1'\]\.includes\(location\.hostname\)/);
 assert.match(appSource,/localReview\)state\.tickets=Math\.max\(state\.tickets,9999\)/);
});
for(const [rarity,max] of Object.entries({SSR:3,SR:5,R:8,N:10})){
 test(`${rarity} renders correct total, lit and empty stars`,()=>{
  for(const count of [0,1,max]){const html=starsMarkup(rarity,count);assert.equal((html.match(/<svg /g)||[]).length,max);assert.equal((html.match(/class="star lit"/g)||[]).length,count);assert.equal((html.match(/class="star unlit"/g)||[]).length,max-count);assert.ok(html.includes(`aria-label="${count}/${max}星"`));assert.ok(html.includes(`--star-cols:${rarity==='R'?4:Math.min(max,5)}`));}
 });
}

test('rules copy preserves rates, guarantees and exchange boundaries',()=>{
 for(const text of ['SSR 1.5%、SR 3.5%、R 25%、N 70%。','SSR最多60抽获得。','每十抽至少获得一张SR','十连中出现的SSR不能替代保底SR','100印记可兑换任意未满星SSR卡一张','余晖可兑换N、R、SR卡'])assert.ok(appSource.includes(text));
});

test('currency tooltips are shared by home, collection and utility pages',()=>{
 for(const text of ['home-wallet','currency-strip','用于展卷的珍贵道具','每一次展卷可获取一个，满100个可兑换SSR','满星卡溢出时获得的稀有道具，可用于兑换卡面'])assert.ok(appSource.includes(text));
 assert.match(appSource,/function utilityHeader\(title\).*currencyStrip\(\)/);
 assert.match(appSource,/collection-page.*currencyStrip\(\).*collection-heading/);
 assert.match(appSource,/data-currency-tip/);
 assert.match(appSource,/function toggleCurrencyTip/);
 assert.match(styleSource,/\.wallet-item\.is-open \.wallet-tip/);
});

test('portrait phones get a three-second soft-landscape handoff',()=>{
 assert.ok(indexSource.includes('日晷需横屏体验'));
 assert.ok(indexSource.includes('rotate-countdown'));
 assert.match(appSource,/setTimeout\(enterSoftLandscape,3000\)/);
 assert.match(appSource,/classList\.add\('soft-landscape'\)/);
 assert.match(styleSource,/html\.soft-landscape #game-root/);
});

test('mobile ten-pull overview keeps all cards in a fixed two-row grid',()=>{
 assert.match(appSource,/ten-pull-modal/);
 assert.match(appSource,/bonus-result/);
 assert.match(styleSource,/\.ten-pull-modal \.draw-results\{[^}]*grid-template-columns:repeat\(5/);
 assert.match(styleSource,/\.ten-pull-modal \.result-card\{[^}]*aspect-ratio:2\/3/);
 assert.match(styleSource,/\.ten-pull-modal \.result-card img\{[^}]*object-fit:contain/);
 assert.match(styleSource,/\.result-card\.SSR \.collection-rarity\{color:#a17a26/);
 assert.match(styleSource,/\.result-card\.SR \.collection-rarity\{color:#79549d/);
 assert.match(styleSource,/grid-template-rows:repeat\(2/);
 assert.match(styleSource,/\.ten-pull-modal \.draw-results\{[^}]*overflow:hidden/);
});

test('full-star detail uses the approved concise wording everywhere',()=>{
 assert.ok(appSource.includes("full?'已满星'"));
 assert.ok(!appSource.includes('已经满星'));
});

test('single pull stays complete and offers a one-pull redraw',()=>{
 assert.match(appSource,/redrawCount=count===1\?1:10/);
 assert.ok(appSource.includes("count===1?'再展一卷':'再展十卷'"));
 assert.match(styleSource,/dialog\.draw-modal\{[^}]*width:min\(960px,96vw\)[^}]*height:min\(90dvh,680px\)/);
 assert.match(styleSource,/\.single-pull-modal \.result-card\{[^}]*aspect-ratio:2\/3/);
 assert.match(styleSource,/\.single-pull-modal \.result-card img\{[^}]*object-fit:contain/);
});

test('the result panel itself uses a skippable scroll animation and rare-card light effects',()=>{
 assert.ok(styleSource.includes("url('../assets/scroll-reveal.png')"));
 assert.match(appSource,/document\.addEventListener\('pointerdown',drawRevealSkip/);
 assert.match(appSource,/setTimeout\(finishDrawReveal,2400\)/);
 assert.match(appSource,/scroll-roller scroll-roller-left/);
 assert.match(appSource,/scroll-roller scroll-roller-right/);
 assert.match(styleSource,/@keyframes scroll-sheet-unroll/);
 assert.match(styleSource,/@keyframes scroll-roll-left/);
 assert.match(styleSource,/@keyframes scroll-roll-right/);
 assert.ok(!appSource.includes('scroll-card'));
 assert.match(styleSource,/@keyframes rare-border-spin/);
 assert.match(styleSource,/\.result-card\.SSR:before,\.result-card\.SR:before/);
});
