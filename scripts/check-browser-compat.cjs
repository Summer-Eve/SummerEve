// Run against an already running local server. Uses fresh contexts, never user saves.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const base=process.argv[2]||'http://127.0.0.1:4177/';
const out=path.resolve(__dirname,'../qa/browser-compat');
function differences(a,b){
 const x=PNG.sync.read(a),y=PNG.sync.read(b);assert.equal(x.width,y.width);assert.equal(x.height,y.height);
 // GPU image resampling can round an edge channel by 1 between identical frames.
 let pixels=0,roundingPixels=0;const samples=[];
 for(let i=0;i<x.data.length;i+=4){const delta=Math.max(...[0,1,2].map(k=>Math.abs(x.data[i+k]-y.data[i+k])));if(delta>2){pixels++;if(samples.length<12)samples.push({x:(i/4)%x.width,y:Math.floor(i/4/x.width),delta});}else if(delta)roundingPixels++;}
 return {pixels,roundingPixels,total:x.width*x.height,samples};
}
async function navigation(page){
 const geometry=await page.evaluate(()=>{
  const nav=document.querySelector('.side-nav').getBoundingClientRect();
  const main=document.querySelector('.collection-page,.utility-page');
  const overlap=r=>Math.max(0,Math.min(nav.right,r.right)-Math.max(nav.left,r.left))*Math.max(0,Math.min(nav.bottom,r.bottom)-Math.max(nav.top,r.top));
  const targets=main?[main]:[...document.querySelectorAll('.hero-copy,.identity-dock,.draw-dock')];
  return {nav:nav.toJSON(),overlaps:targets.map(x=>({class:x.className,area:overlap(x.getBoundingClientRect())})),scrollWidth:main?.scrollWidth,clientWidth:main?.clientWidth};
 });
 assert.ok(geometry.overlaps.every(x=>x.area<1),JSON.stringify(geometry));
 if(geometry.scrollWidth)assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,JSON.stringify(geometry));
 for(const button of await page.locator('.side-nav button').all()){
  assert.ok(await button.evaluate(b=>{const r=b.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return b===e||b.contains(e);}));
 }
 return geometry;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const {newSave}=await import(pathToFileURL(path.resolve(__dirname,'../src/engine.js')));
 const {CARDS}=await import(pathToFileURL(path.resolve(__dirname,'../src/data.js')));
 const browser=await chromium.launch({channel:'msedge',headless:true});const report=[];
 try{
  // A painted control proves auto-dark is genuinely enabled, not just a media query.
  const control=await browser.newPage({viewport:{width:100,height:100}});
  await control.setContent('<style>body{margin:0;background:white}</style>');
  const c=await control.context().newCDPSession(control),before=await control.screenshot();
  await c.send('Emulation.setAutoDarkModeOverride',{enabled:true});
  const changed=differences(before,await control.screenshot());assert.equal(changed.pixels,changed.total);
  report.push({unprotectedControlDarkened:true});await control.context().close();
  const sizes=[['desktop',1440,900],['oppo-portrait',424,735],['iphone-portrait',390,700],['small-portrait',360,640],['landscape',844,390],['short-toolbar',780,280]];
  for(const [label,width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block',colorScheme:'light'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const save=newSave();save.settings.sound=false;save.settings.fast=true;save.settings.reduced=true;save.copies[CARDS[0].id]=1;save.marks=100;save.totalDraws=100;save.received=100;
   await page.addInitScript(s=>{localStorage.setItem('rigui.save.v1',JSON.stringify(s));Math.random=()=>.9;},save);
   await page.goto(base);await page.locator('#startup').waitFor({state:'detached',timeout:90000});
   if(width<height)await page.waitForFunction(()=>document.documentElement.classList.contains('soft-landscape'));
   await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
   const cd=await context.newCDPSession(page),views=[];
   async function samePixels(view){
    await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode().catch(()=>{}))));
    await page.emulateMedia({colorScheme:'light'});await cd.send('Emulation.setAutoDarkModeOverride',{enabled:false});
    const light=await page.screenshot();
    await page.emulateMedia({colorScheme:'dark'});const media=await page.screenshot();
    await cd.send('Emulation.setAutoDarkModeOverride',{enabled:true});const forced=await page.screenshot();
    const md=differences(light,media),fd=differences(light,forced);
    if(md.pixels||fd.pixels){fs.writeFileSync(path.join(out,label+'-'+view+'-light.png'),light);fs.writeFileSync(path.join(out,label+'-'+view+'-media.png'),media);fs.writeFileSync(path.join(out,label+'-'+view+'-forced.png'),forced);console.error({label,view,md,fd});}
    assert.equal(md.pixels,0,`${label} ${view}: dark preference`);assert.equal(fd.pixels,0,`${label} ${view}: forced dark`);
    fs.writeFileSync(path.join(out,label+'-'+view+'.png'),forced);views.push({view,mediaChangedPixels:md.pixels,forcedChangedPixels:fd.pixels,roundingPixels:Math.max(md.roundingPixels,fd.roundingPixels),channelTolerance:2});
   }
   await navigation(page);assert.equal(await page.locator('.carousel-slide.active').evaluate(x=>getComputedStyle(x).mixBlendMode),'normal');await samePixels('home');
   await page.locator('[data-collection]').first().click();const initial=await navigation(page);
   const cards=await page.locator('.collection-card').evaluateAll(xs=>xs.map(x=>({unowned:x.classList.contains('unowned'),lit:x.querySelectorAll('.star.lit').length,filter:getComputedStyle(x.querySelector('img')).filter,blend:getComputedStyle(x.querySelector('img')).mixBlendMode})));
   assert.ok(cards.filter(x=>x.unowned).every(x=>x.lit===0&&x.filter.includes('grayscale')));assert.ok(cards.every(x=>x.blend==='normal'));
   await samePixels('collection');
   await page.locator('.collection-page').evaluate(x=>{x.scrollLeft=100000;x.scrollTop=100000;});await navigation(page);
   await page.locator('.collection-card').last().focus();await navigation(page);
   await page.locator('.collection-page').evaluate(x=>{x.scrollTop=0;x.scrollLeft=0;});
   await page.locator('.collection-card').first().click();await samePixels('detail');
   await page.locator('[data-exchange]').click();await page.locator('.exchange-card img').evaluate(x=>x.decode());await samePixels('exchange-success');
   await page.locator('.exchange-heading').click();
   await page.locator('[data-history]').click();await navigation(page);
   await page.locator('[data-settings]').click();await navigation(page);
   await page.locator('.utility-page').evaluate(x=>{x.scrollLeft=100000;x.scrollTop=100000;});await navigation(page);
   await samePixels('settings');
   await page.locator('[data-home]').click();await page.locator('[data-draw="10"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.result-card.image-ready').length===10);
   assert.equal(await page.locator('.result-card').count(),10);await samePixels('ten-pull');await page.keyboard.press('Escape');
   if(width<height){
    // Browser toolbar expansion/shrinking without an orientation change.
    for(const next of [height-90,height+70,height]){
     await page.setViewportSize({width,height:next});await page.locator('[data-collection]').first().click();await navigation(page);
     const root=await page.locator('#game-root').boundingBox();assert.ok(Math.abs(root.width-width)<1&&Math.abs(root.height-next)<1,JSON.stringify(root));
    }
   }
   assert.deepEqual(errors,[]);report.push({label,viewport:[width,height],navigationSeparated:true,initial,views,pageErrors:errors});
   await context.close();
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
