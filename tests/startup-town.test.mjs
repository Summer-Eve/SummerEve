import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TOWN_CYCLE_MS,BUILDING_RISE_MS,startTown} from '../src/startup-town.js';
test('three frontal building layers and two covered bridges replace the single color reveal',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.equal((html.match(/data-building=/g)||[]).length,3);
 assert.equal((html.match(/data-corridor=/g)||[]).length,2);
 assert.doesNotMatch(html,/pavilion-building|pavilion-reveal/);
 assert.equal(TOWN_CYCLE_MS,5200);assert.equal(BUILDING_RISE_MS,1300);
});
test('town is uniformly half-size around its center, without changing progress or layer motion',()=>{
 const css=readFileSync(new URL('../src/startup.css',import.meta.url),'utf8');
 assert.match(css,/\.startup-town\{[^}]*transform:scale\(\.5\);transform-origin:center/);
 assert.doesNotMatch(css,/\.startup-floor[^}]*transform:scale/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/loading-pavilions-front-v4\.webp/);
 assert.match(html,/loading-corridor-front-v4\.webp/);
});
test('buildings rise for 1.3 seconds each in a repeating 5.2 second loop, without color changes',()=>{
 const css=readFileSync(new URL('../src/startup.css',import.meta.url),'utf8');
 assert.match(css,/animation-duration:5\.2s;animation-iteration-count:infinite/);
 assert.match(css,/@keyframes town-first\{0%\{transform:translateY\(720px\)\}25%/);
 assert.match(css,/@keyframes town-second\{0%,25%\{transform:translateY\(720px\)\}50%/);
 assert.match(css,/@keyframes town-third\{0%,50%\{transform:translateY\(720px\)\}75%/);
 assert.equal((css.match(/96%\{transform:translateY\(0\);animation-timing-function:steps\(1,end\)\}/g)||[]).length,5);
 assert.doesNotMatch(css,/filter:|grayscale|saturate|transition:opacity/);
 assert.match(css,/prefers-reduced-motion:reduce.*animation:none;transform:translateY\(0\)/);
});
test('loop starts once, stops without frame timers, and cannot delay real resource progress or game entry',()=>{
 const classes=new Set(),root={classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
 const stop=startTown(root);startTown(root);assert.equal(classes.size,1);stop();stop();assert.equal(classes.size,0);
 const module=readFileSync(new URL('../src/startup-town.js',import.meta.url),'utf8');
 assert.doesNotMatch(module,/setTimeout|setInterval|requestAnimationFrame|percent/);
 const startup=readFileSync(new URL('../src/startup.js',import.meta.url),'utf8');
 assert.match(startup,/const stopTown=startTown\(town\)/);
 assert.match(startup,/bar.value=value;percent.textContent=value\+'%'/);
 assert.match(startup,/stopTown\(\);\s*document.documentElement.classList.remove\('booting'\)/);
 assert.doesNotMatch(startup,/paintTown|settleTown|await.*Town/);
});
