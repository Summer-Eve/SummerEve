// Foreground image decoding takes precedence over optional cache warming.
export function createResourceActivity(){
  let active=0;const waiting=new Set();
  return {
    hold(){
      active++;let released=false;
      return ()=>{if(released)return;released=true;active--;if(!active){for(const resolve of waiting)resolve();waiting.clear();}};
    },
    wait(){return active?new Promise(resolve=>waiting.add(resolve)):Promise.resolve();},
    get active(){return active;}
  };
}
export const resourceActivity=createResourceActivity();
