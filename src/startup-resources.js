import {CARDS} from './data.js?v=20261003-r5';

export const RESOURCE_VERSION='20261003-r5';
export function resourceCacheName(base){
  return 'rigui-resources:'+new URL(base).pathname+':'+RESOURCE_VERSION;
}
export function startupResources(){
  const core=['app2.js','data.js','engine.js','storage.js','audio.js','presentation.js','result-images.js','exchange-feedback.js','startup.js','startup-resources.js','resource-loader.js','startup-town.js','styles.css','presentation.css','mobile.css','startup.css'];
  return [
    ...core.map(file=>({url:`./src/${file}?v=${RESOURCE_VERSION}`,required:true})),
    ...['loading-pavilions-front-v4.webp','loading-corridor-front-v4.webp'].map(file=>({url:'./assets/'+file,required:false})),
    ...[...new Set(CARDS.flatMap(card=>[card.art,card.art.replace('./assets/','./assets/draw/')]))].map(url=>({url,required:false})),
    ...['palace-bg-v2.webp','scroll-reveal.webp','favicon.svg','audio/courtyard-story-v1.wav','audio/pages-turn-v3.wav','audio/scroll-wood-v3.wav','audio/exchange-success-v1.wav'].map(file=>({url:'./assets/'+file,required:false}))
  ];
}
