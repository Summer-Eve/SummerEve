import {newSave,validateSave} from './engine.js';
export const SAVE_KEY='rigui.save.v1';
export const BACKUP_KEY='rigui.save.backup.v1';
export function loadSave(storage=localStorage) {
  let main,backup;
  try { main=storage.getItem(SAVE_KEY); backup=storage.getItem(BACKUP_KEY); } catch {return {save:newSave(),warning:'浏览器禁止保存。请允许网站存储，并在退出前导出存档。',blocked:true};}
  if(!main)return {save:newSave(),warning:'',blocked:false};
  try{return {save:validateSave(JSON.parse(main)),warning:'',blocked:false};}catch{}
  if(backup)try{return {save:validateSave(JSON.parse(backup)),warning:'主存档损坏，已恢复上一份自动备份。请立即导出备份。',blocked:false};}catch{}
  return {save:null,warning:'存档无法读取。原始数据已保留，可导出损坏存档后导入备份或重置。',blocked:true};
}
export function persist(save,storage=localStorage) {
  const data=JSON.stringify(validateSave(save));
  const old=storage.getItem(SAVE_KEY);
  if(old){try{validateSave(JSON.parse(old));storage.setItem(BACKUP_KEY,old);}catch{}}
  storage.setItem(SAVE_KEY,data);
}
