import path from 'node:path'; import fs from 'node:fs'; import { findRoot, getActive, loadMission } from './lib.mjs';
let input=''; for await(const c of process.stdin) input+=c; let p={}; try{p=JSON.parse(input||'{}')}catch{process.exit(0)}
const root=findRoot(); const id=getActive(root); if(!id) process.exit(0);
let m; try{m=loadMission(root,id)}catch{process.exit(0)}
if(!['BUILDING','VERIFYING','CORRECTION_REQUIRED'].includes(m.status)) process.exit(0);
const file=String(p?.tool_input?.file_path??p?.tool_input?.path??''); if(!file) process.exit(0);
const rel=path.relative(root,path.resolve(root,file)).replaceAll('\\','/');
const allowed=[...(m.scope?.allowedPaths||[]),'company/missions/**','company/registers/**'];
const match=(pat)=>{ if(pat.endsWith('/**')) return rel.startsWith(pat.slice(0,-3)); if(pat.includes('*')){const re=new RegExp('^'+pat.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('**','.*').replaceAll('*','[^/]*')+'$');return re.test(rel)} return rel===pat; };
if(allowed.some(match)) process.exit(0);
process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:`Datei außerhalb des Missionsscopes: ${rel}. Scope zuerst im Missionsvertrag erweitern und Konsumenten prüfen.`}}));
