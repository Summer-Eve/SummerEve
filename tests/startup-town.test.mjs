import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BUILDING_RANGES,CORRIDOR_RANGES,layerRise,paintTown} from '../src/startup-town.js';
test('three frontal building layers and two covered bridges replace the single color reveal',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.equal((html.match(/data-building=/g)||[]).length,3);
 assert.equal((html.match(/data-corridor=/g)||[]).length,2);
 assert.doesNotMatch(html,/pavilion-building|pavilion-reveal/);
 assert.equal(BUILDING_RANGES.length,3);assert.equal(CORRIDOR_RANGES.length,2);
});
test('town is uniformly half-size around its center, without changing progress or layer motion',()=>{
 const css=readFileSync(new URL('../src/startup.css',import.meta.url),'utf8');
 assert.match(css,/\.startup-town\{[^}]*transform:scale\(\.5\);transform-origin:center/);
 assert.doesNotMatch(css,/\.startup-floor[^}]*transform:scale/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/loading-pavilions-front-v4\.webp/);
 assert.match(html,/loading-corridor-front-v4\.webp/);
});
test('buildings rise in order, with full colors unchanged and no motion in the opposite direction',()=>{
 assert.deepEqual(BUILDING_RANGES.map(range=>layerRise(0,range,720)),[720,720,720]);
 assert.deepEqual(BUILDING_RANGES.map(range=>layerRise(30,range,720)),[0,720,720]);
 assert.deepEqual(BUILDING_RANGES.map(range=>layerRise(64,range,720)),[0,0,720]);
 assert.deepEqual(BUILDING_RANGES.map(range=>layerRise(100,range,720)),[0,0,0]);
 for(const range of [...BUILDING_RANGES,...CORRIDOR_RANGES]){
  let previous=1000;for(let progress=0;progress<=100;progress++){const y=layerRise(progress,range,720);assert.ok(y<=previous);previous=y;}
 }
 const buildings=BUILDING_RANGES.map(()=>({style:{}})),bridges=CORRIDOR_RANGES.map(()=>({style:{}}));
 const root={querySelectorAll:selector=>selector==='[data-building]'?buildings:bridges};
 paintTown(root,100);for(const layer of [...buildings,...bridges])assert.deepEqual(layer.style,{transform:'translateY(0px)'});
 const css=readFileSync(new URL('../src/startup.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/filter:|grayscale|saturate|transition:opacity/);assert.match(css,/prefers-reduced-motion/);
});
