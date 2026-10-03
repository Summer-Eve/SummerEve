import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CARDS,RULES} from '../src/data.js';
import {drawArt} from '../src/presentation.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const version='20261003-r1';
const baseline='47681a623e9c0d616f3370d5552356826e82cc16';
const output=path.resolve(root,'../releases/rigui-'+version);
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const sourceCommit=git('rev-parse','HEAD').toString().trim();
assert.equal(git('diff','--name-only','HEAD').toString().trim(),'','Commit tracked edits before archiving');
const runtime=['src/app2.js','src/data.js','src/engine.js','src/presentation.js','src/result-images.js','src/review.js','src/storage.js','src/styles.css','src/mobile.css','src/presentation.css','src/audio.js','src/exchange-feedback.js'];
const audio=[
  {path:'assets/audio/courtyard-story-v1.wav',source:'Original program-synthesized music: scripts/make_audio.py'},
  {path:'assets/audio/pages-turn-v3.wav',source:'User-supplied mixkit-single-book-paging-1101.wav; mono conversion'},
  {path:'assets/audio/scroll-wood-v3.wav',source:'User-supplied mixkit-wood-hard-hit-2182.wav; mono conversion and one-second window'},
  {path:'assets/audio/exchange-success-v1.wav',source:'User-supplied 点击兑换.wav; bytes unchanged'}
];
const files=[...new Set(['index.html',...runtime,'assets/favicon.svg','assets/palace-bg-v2.webp','assets/scroll-reveal.webp',...audio.map(a=>a.path),...CARDS.flatMap(c=>[c.art.slice(2),drawArt(c).slice(2)])])].sort();
assert.equal(CARDS.length,95);assert.equal(new Set(CARDS.map(c=>c.art)).size,95);assert.equal(new Set(CARDS.map(drawArt)).size,95);
assert.ok(CARDS.every(c=>c.max===5&&c.artStatus==='approved-unique'));
assert.equal(git('diff','--name-only',baseline,sourceCommit,'--',...files).toString().trim(),'','Runtime differs from accepted online baseline');
for(const file of files){
  assert.ok(!file.includes('..')&&!path.isAbsolute(file));
  const committed=git('show',baseline+':'+file);
  const local=await readFile(path.join(root,file));
  const normalize=bytes=>/\.(html|js|css|svg)$/.test(file)?bytes.toString('utf8').replaceAll('\r\n','\n'):hash(bytes);
  assert.equal(normalize(local),normalize(committed),'Uncommitted runtime differs: '+file);
}
await mkdir(path.dirname(output),{recursive:true});
await mkdir(output); // Fail rather than overwrite an existing archive.
const web=path.join(output,'web'),records=[];
for(const file of files){
  const bytes=git('show',baseline+':'+file),target=path.join(web,file);
  await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);
  records.push({path:file,bytes:bytes.length,sha256:hash(bytes)});
}
const recordFor=file=>records.find(r=>r.path===file);
const cards=CARDS.map(c=>({id:c.id,name:c.displayName,title:c.title,rarity:c.rarity,max:c.max,characterId:c.characterId,art:recordFor(c.art.slice(2)),drawPreview:recordFor(drawArt(c).slice(2))}));
const counts=Object.fromEntries(['SSR','SR','R','N'].map(r=>[r,CARDS.filter(c=>c.rarity===r).length]));
assert.deepEqual(counts,{SSR:5,SR:15,R:25,N:50});
const json=async(name,data)=>writeFile(path.join(output,name),JSON.stringify(data,null,2)+'\n');
await json('card-manifest.json',{version,cards});
await mkdir(path.join(output,'docs'));
for(const file of ['RELEASE-20261003.md','GAME.md','DEVICE-QA.md','assets/audio/README.md']){
  await writeFile(path.join(output,'docs',file==='assets/audio/README.md'?'AUDIO-SOURCES.md':file),git('show',sourceCommit+':'+file));
}
const webZip=path.join(output,'rigui-'+version+'-web.zip');
execFileSync('pwsh',['-NoProfile','-NonInteractive','-Command',
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('+quote(web)+','+quote(webZip)+',[System.IO.Compression.CompressionLevel]::Optimal,$false)'],{stdio:'pipe'});
const sourceZip=path.join(output,'rigui-'+version+'-source.zip');
git('archive','--format=zip','--output='+sourceZip,sourceCommit);
const sourceFiles=git('ls-tree','-r','--name-only',sourceCommit).toString().trim().split('\n').map(file=>{
  const bytes=git('show',sourceCommit+':'+file);return {path:file,bytes:bytes.length,sha256:hash(bytes)};
});
const packages=[];
for(const file of [webZip,sourceZip])packages.push({path:path.basename(file),bytes:(await stat(file)).size,sha256:hash(await readFile(file))});
await json('archive-manifest.json',{version,acceptanceDate:'2026-10-03',acceptanceSource:'User confirmed real-device review complete',url:'https://summer-eve.github.io/SummerEve/?v='+version,baseline,sourceCommit,counts,totalEffectiveCopies:475,rules:RULES,audio:audio.map(a=>({...a,...recordFor(a.path)})),files:records,sourceFiles,packages});
for(const record of records)assert.equal(hash(await readFile(path.join(web,record.path))),record.sha256);
await json('verification.json',{version,checks:{cardCount:95,artwork:95,drawPreviews:95,maxStars:5,audio:4,files:records.length,baselineRuntimeUnchanged:true,workingCopyMatchesBaseline:true,webFileHashes:true},packages,zipReadback:'Run scripts/verify-release-archive.ps1 to verify both ZIPs before delivery'});
console.log(JSON.stringify({output,version,baseline,sourceCommit,files:records.length,cards:95,audio:4,packages},null,2));
