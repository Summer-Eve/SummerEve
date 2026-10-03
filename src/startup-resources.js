import {CARDS} from './data.js?v=20261004-r10';

export const RESOURCE_VERSION='20261004-r10';
export function resourceCacheName(base){
  return 'rigui-resources:'+new URL(base).pathname+':'+RESOURCE_VERSION;
}
export function startupResources(){
  const core=['app2.js','data.js','engine.js','storage.js','audio.js','presentation.js','result-images.js','resource-activity.js','exchange-feedback.js','page-scroll.js','startup.js','startup-resources.js','resource-loader.js','startup-town.js','styles.css','presentation.css','mobile.css','startup.css','browser-compat.css'];
  const homeArt=new Set(CARDS.filter(card=>card.rarity==='SSR').map(card=>card.art));
  return [
    ...core.map(file=>({url:`./src/${file}?v=${RESOURCE_VERSION}`,required:true})),
    ...['loading-pavilions-front-v4.webp','loading-corridor-front-v4.webp'].map(file=>({url:'./assets/'+file,required:false})),
    // Every possible draw has a ready preview; the homepage keeps its original art.
    ...[...new Set(CARDS.map(card=>card.art.replace('./assets/','./assets/draw/')))].map(url=>({url,required:true})),
    ...[...new Set(CARDS.map(card=>card.art))].map(url=>({url,required:homeArt.has(url)})),
    ...['palace-bg-v2.webp','scroll-reveal.webp'].map(file=>({url:'./assets/'+file,required:true})),
    ...['favicon.svg','audio/courtyard-story-v1.wav','audio/pages-turn-v3.wav','audio/scroll-wood-v3.wav','audio/exchange-success-v1.wav'].map(file=>({url:'./assets/'+file,required:false}))
  ];
}
