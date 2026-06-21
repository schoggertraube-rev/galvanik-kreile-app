import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export function findRoot(start = process.cwd()) {
  let cur = path.resolve(start);
  while (true) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) throw new Error('Projektroot mit package.json nicht gefunden');
    cur = parent;
  }
}
export const now = () => new Date().toISOString();
export function ensureDir(p){ fs.mkdirSync(p,{recursive:true}); }
export function readJson(p, fallback=null){ try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch(e){if(fallback!==null)return fallback;throw e;} }
export function writeJson(p,v){ ensureDir(path.dirname(p)); const t=p+'.tmp'; fs.writeFileSync(t,JSON.stringify(v,null,2)+'\n'); fs.renameSync(t,p); }
export function appendJsonl(p,v){ ensureDir(path.dirname(p)); fs.appendFileSync(p,JSON.stringify(v)+'\n'); }
export function writeText(p,v){ ensureDir(path.dirname(p)); fs.writeFileSync(p,v,'utf8'); }
export function readText(p,f=''){ try{return fs.readFileSync(p,'utf8')}catch{return f} }
export function slug(s){ return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'mission'; }
export function sha256(p){ return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }
export function nextIdeaId(root){
  const d=new Date(); const day=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const dir=path.join(root,'company','missions'); ensureDir(dir);
  const n=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()&&x.name.startsWith(`IDEA-${day}-`)).length+1;
  return `IDEA-${day}-${String(n).padStart(3,'0')}`;
}
export function run(cmd,args=[],opts={}){
  return new Promise((resolve)=>{
    const child=spawn(cmd,args,{cwd:opts.cwd,env:{...process.env,...(opts.env||{})},shell:false,windowsHide:true});
    let stdout='',stderr='';
    child.stdout?.on('data',d=>stdout+=d); child.stderr?.on('data',d=>stderr+=d);
    child.on('error',e=>resolve({code:127,stdout,stderr:stderr+e.message}));
    child.on('close',code=>resolve({code:code??1,stdout,stderr}));
  });
}
export function runShell(command,opts={}){
  if(process.platform==='win32') return run('cmd.exe',['/d','/s','/c',command],opts);
  return run('/bin/bash',['-lc',command],opts);
}
export async function commandExists(command,cwd){
  if(process.platform==='win32'){ const r=await run('where.exe',[command],{cwd}); return r.code===0; }
  const r=await run('which',[command],{cwd}); return r.code===0;
}

export function activeFile(root){ return path.join(root,'company','state','ACTIVE_MISSION'); }
export function setActive(root,id=''){ writeText(activeFile(root),id); }
export function getActive(root){ return readText(activeFile(root),'').trim(); }
export function missionDir(root,id){ return path.join(root,'company','missions',id); }
export function missionFile(root,id){ return path.join(missionDir(root,id),'mission.json'); }
export function loadMission(root,id){ return readJson(missionFile(root,id)); }
export function saveMission(root,m){ m.updatedAt=now(); writeJson(missionFile(root,m.id),m); appendJsonl(path.join(root,'company','registers','missions.jsonl'),{id:m.id,status:m.status,updatedAt:m.updatedAt}); }
export function listMissions(root){
  const dir=path.join(root,'company','missions'); ensureDir(dir);
  return fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>{try{return loadMission(root,x.name)}catch{return null}}).filter(Boolean).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
export function parseResult(raw){
  try{ const j=JSON.parse(raw); return j.result||j.response||j.content||raw; }catch{return raw;}
}
export function relative(root,p){ return path.relative(root,p).replaceAll('\\','/'); }
