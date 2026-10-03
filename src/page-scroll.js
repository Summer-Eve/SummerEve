// Keep list scrolling independent of embedded-browser scroll-chain handling.
// Wheel/keyboard scrolling stays native; pinch zoom and form controls are untouched.
export function installPageScroll(root){
 const document=root.ownerDocument,window=document.defaultView;
 let gesture=null,frame=null,suppressed=null;
 const rotated=()=>document.documentElement.classList.contains('soft-landscape');
 const stop=()=>{if(frame!==null)window.cancelAnimationFrame(frame);frame=null;};
 const clamp=(page,top)=>Math.max(0,Math.min(page.scrollHeight-page.clientHeight,top));
 const editable=target=>target.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
 function start(event){
  stop();gesture=null;suppressed=null;
  if(event.touches.length!==1||editable(event.target))return;
  const page=event.target.closest('.collection-page,.utility-page');
  if(!page||!root.contains(page)||page.scrollHeight<=page.clientHeight+1)return;
  const touch=event.touches[0];
  gesture={page,id:touch.identifier,x:touch.clientX,y:touch.clientY,top:page.scrollTop,rotated:rotated(),axis:null,moved:false,lastTop:page.scrollTop,lastTime:window.performance.now(),velocity:0};
 }
 function move(event){
  const g=gesture;
  if(!g)return;
  if(event.touches.length!==1||!g.page.isConnected||g.rotated!==rotated()){gesture=null;return;}
  const touch=[...event.touches].find(touch=>touch.identifier===g.id);if(!touch)return;
  const dx=touch.clientX-g.x,dy=touch.clientY-g.y;
  if(!g.axis){
   if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
   if(!g.rotated&&Math.abs(dx)>Math.abs(dy)){gesture=null;return;}
   g.axis=g.rotated&&Math.abs(dx)>Math.abs(dy)?'x':'y';
  }
  if(!event.cancelable){gesture=null;return;}
  event.preventDefault();g.moved=true;
  const top=clamp(g.page,g.top+(g.axis==='x'?dx:-dy)),now=window.performance.now(),elapsed=Math.max(1,now-g.lastTime);
  g.velocity=Math.max(-2.5,Math.min(2.5,(top-g.lastTop)/elapsed));g.lastTop=top;g.lastTime=now;g.page.scrollTop=top;
 }
 function end(){
  const g=gesture;gesture=null;if(!g?.moved)return;
  suppressed={page:g.page,until:window.performance.now()+500};
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||window.performance.now()-g.lastTime>100)return;
  let velocity=g.velocity,last=window.performance.now(),elapsed=0;
  function coast(now){
   frame=null;if(!g.page.isConnected||g.rotated!==rotated())return;
   const dt=Math.min(32,now-last);last=now;elapsed+=dt;
   const before=g.page.scrollTop;g.page.scrollTop=clamp(g.page,before+velocity*dt);velocity*=Math.pow(.92,dt/16);
   if(elapsed<800&&Math.abs(velocity)>.03&&Math.abs(g.page.scrollTop-before)>.1)frame=window.requestAnimationFrame(coast);
  }
  frame=window.requestAnimationFrame(coast);
 }
 function cancel(){gesture=null;stop();}
 function click(event){
  if(event.detail!==0&&suppressed&&window.performance.now()<suppressed.until&&suppressed.page.contains(event.target)){
   event.preventDefault();event.stopImmediatePropagation();suppressed=null;
  }
 }
 root.addEventListener('touchstart',start,{passive:true});
 root.addEventListener('touchmove',move,{passive:false});
 root.addEventListener('touchend',end,{passive:true});
 root.addEventListener('touchcancel',cancel,{passive:true});
 root.addEventListener('click',click,true);
 window.addEventListener('resize',cancel);window.addEventListener('pagehide',cancel);
 return ()=>{cancel();root.removeEventListener('touchstart',start);root.removeEventListener('touchmove',move);root.removeEventListener('touchend',end);root.removeEventListener('touchcancel',cancel);root.removeEventListener('click',click,true);window.removeEventListener('resize',cancel);window.removeEventListener('pagehide',cancel);};
}
