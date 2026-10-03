// Decorative CSS loop, independent of real download progress; no JS frame timer.
export const TOWN_CYCLE_MS=5200;
export const BUILDING_RISE_MS=1300;
export function startTown(root){
  root.classList.add('town-playing');
  return ()=>root.classList.remove('town-playing');
}
