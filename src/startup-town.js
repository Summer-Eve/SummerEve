export const BUILDING_RANGES=[[0,30],[30,64],[64,92]];
export const CORRIDOR_RANGES=[[54,70],[88,100]];
export function layerRise(percent,[start,end],distance){
  const amount=Math.max(0,Math.min(1,(percent-start)/(end-start)));
  return Math.round(distance*(1-amount));
}
export function paintTown(root,percent){
  root.querySelectorAll('[data-building]').forEach((layer,index)=>{
    layer.style.transform=`translateY(${layerRise(percent,BUILDING_RANGES[index],720)}px)`;
  });
  root.querySelectorAll('[data-corridor]').forEach((layer,index)=>{
    layer.style.transform=`translateY(${layerRise(percent,CORRIDOR_RANGES[index],180)}px)`;
  });
}
export async function settleTown(root){
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const animations=root.getAnimations?.({subtree:true})||[];
  // Finish the visible rise even when the actual cached load jumps straight to 100%.
  await Promise.race([
    Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))),
    new Promise(resolve=>setTimeout(resolve,1600))
  ]);
}
