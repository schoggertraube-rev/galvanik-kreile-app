import fs from 'node:fs'; import path from 'node:path'; import { findRoot,getActive,loadMission } from './lib.mjs';
const root=findRoot(); const id=getActive(root); if(!id) process.exit(0); let m; try{m=loadMission(root,id)}catch{process.exit(0)}
if(!['VERIFYING','PREVIEW_DEPLOY','PRODUCTION_DEPLOY','LIVE_VERIFY'].includes(m.status)) process.exit(0);
const p=path.join(root,'company','missions',id,'evidence','latest-quality.json');
if(!fs.existsSync(p)) {process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'TaskCompleted',permissionDecision:'deny',permissionDecisionReason:'Maschineller Quality-Gate-Nachweis fehlt.'}}));process.exit(0)}
const q=JSON.parse(fs.readFileSync(p,'utf8')); const bad=(q.results||[]).filter(x=>x.required&&x.code!==0);
if(bad.length){process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'TaskCompleted',permissionDecision:'deny',permissionDecisionReason:`Pflichtgates fehlgeschlagen: ${bad.map(x=>x.name).join(', ')}`}}));}
