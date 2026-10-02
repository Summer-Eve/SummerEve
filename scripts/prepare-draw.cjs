// Encode only the approved art at result-card resolution; originals stay intact.
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const sharp=require('sharp');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const {CARDS}=await import(pathToFileURL(path.join(root,'src/data.js')));
  await fs.mkdir(path.join(root,'assets/draw'),{recursive:true});
  let originalBytes=0,drawBytes=0;
  for(const card of CARDS){
    const source=path.join(root,card.art.slice(2));
    const target=path.join(root,'assets/draw',path.basename(source));
    try{await fs.access(target);}catch{
      await sharp(source).resize({width:480,withoutEnlargement:true}).webp({quality:78,effort:6}).toFile(target);
    }
    originalBytes+=(await fs.stat(source)).size;drawBytes+=(await fs.stat(target)).size;
  }
  console.log(JSON.stringify({cards:CARDS.length,originalBytes,drawBytes,reductionPercent:Math.round((1-drawBytes/originalBytes)*100)},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
