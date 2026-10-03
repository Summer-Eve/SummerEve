import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startupResources,RESOURCE_VERSION} from '../src/startup-resources.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),css=read('src/browser-compat.css'),app=read('src/app2.js');

test('light-only palette is declared before external styles, including the initial loading screen',()=>{
 assert.ok(html.indexOf('<meta name="color-scheme" content="only light">')<html.indexOf('<link rel="stylesheet"'));
 assert.ok(html.indexOf('<meta name="nightmode" content="disable">')<html.indexOf('<link rel="stylesheet"'));
 assert.match(html,/<style>:root\{color-scheme:light;color-scheme:only light\}/);
 assert.match(css,/:root\{color-scheme:light;color-scheme:only light/);
 assert.doesNotMatch(css,/forced-color-adjust\s*:\s*none|filter\s*:|brightness\(|invert\(/);
});
test('card compositing uses original pixels without removing the unowned-card distinction',()=>{
 assert.match(css,/\.hero-art>img,\.carousel-slide,\.hero-choices img,\.card img,\.detail>img,\.collection-card img,\.result-card img,\.card-detail>img,\.exchange-card img\{color-scheme:only light;mix-blend-mode:normal\}/);
 assert.match(read('src/styles.css'),/\.collection-card\.unowned>img\{filter:grayscale\(\.72\) saturate\(\.65\);opacity:\.72\}/);
});
test('navigation gutter clips a separate content box in both phone orientations',()=>{
 assert.match(css,/margin-left:var\(--nav-space\);width:calc\(100% - var\(--nav-space\)\)/);
 assert.match(css,/overflow-x:hidden;overflow-y:auto/);
 assert.match(css,/--nav-space:calc\(var\(--nav-left\) \+ var\(--nav-width\) \+ 12px\)/);
 assert.match(css,/width:var\(--visible-height,100dvh\);height:var\(--visible-width,100dvw\)/);
 assert.match(app,/setProperty\('--visible-width',width\+'px'\)/);
});
test('browser compatibility sheet is versioned and required before early game entry',()=>{
 assert.ok(startupResources().some(r=>r.required&&r.url===`./src/browser-compat.css?v=${RESOURCE_VERSION}`));
 assert.ok(html.includes(`./src/browser-compat.css?v=${RESOURCE_VERSION}`));
 assert.match(read('sw.js'),new RegExp(`const VERSION='${RESOURCE_VERSION}'`));
});
