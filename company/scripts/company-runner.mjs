#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { findRoot, now, nextIdeaId, ensureDir, readJson, writeJson, writeText, readText, appendJsonl, run, runShell, commandExists, parseResult, setActive, getActive, missionDir, missionFile, loadMission, saveMission, listMissions, relative } from './lib.mjs';

const root=findRoot();
const cfg=readJson(path.join(root,'company','config','company.config.json'));
const args=process.argv.slice(2); const cmd=args[0]||'status';
function val(flag){const i=args.indexOf(flag); return i>=0?args[i+1]:''}
function log(s=''){console.log(s)}
function activeOrLatest(){ const a=getActive(root); if(a)return a; const open=listMissions(root).find(m=>!['LIVE_VERIFIED','REJECTED'].includes(m.status)); return open?.id||''; }
function artifact(m,name,rel){m.artifacts=m.artifacts||{};m.artifacts[name]=rel;saveMission(root,m)}
function phasePath(m,n){return path.join(missionDir(root,m.id),`${n}.md`)}
function promptFile(name){return readText(path.join(root,'company','prompts',name))}
function roleFile(role){return readText(path.join(root,'.claude','agents',`company-${role}.md`))}
function missionContext(m){
  return `MISSION ${m.id}\nSTATUS ${m.status}\nORIGINALINPUT:\n${m.originalInput}\nSTAKEHOLDERFEEDBACK:\n${(m.stakeholderFeedback||[]).join('\n')}\nMISSIONDIR: ${relative(root,missionDir(root,m.id))}`;
}
async function claude(role,m,task,{write=false,model='',maxTurns=12}={}){
  const exe=process.env.COMPANY_CLAUDE_CMD||'claude';
  const prompt=`${missionContext(m)}\n\n${task}\n\nArbeite im Projektroot ${root}. Berichte präzise und kennzeichne FACT/ASSUMPTION/DECISION.`;
  const tools=write?['Read','Glob','Grep','Edit','Write','Bash(git status:*)','Bash(git diff:*)','Bash(npx tsc --noEmit:*)','Bash(npm run lint:*)','Bash(npm run test:*)','Bash(npm run build:*)']:['Read','Glob','Grep','Bash(git status:*)','Bash(git diff:*)'];
  const a=['-p',prompt,'--output-format','json','--model',model||cfg.models.default,'--max-turns',String(maxTurns),'--append-system-prompt',roleFile(role),'--allowedTools',...tools];
  const r=await run(exe,a,{cwd:root,env:{COMPANY_MISSION_ID:m.id,COMPANY_RUNNER_CHILD:'1'}});
  if(r.code!==0) return {ok:false,text:r.stdout+'\n'+r.stderr,code:r.code};
  return {ok:true,text:String(parseResult(r.stdout)),code:0,raw:r.stdout};
}
async function saveRole(role,m,file,task,opts){ const r=await claude(role,m,task,opts); writeText(phasePath(m,file),r.text); artifact(m,file,relative(root,phasePath(m,file))); if(!r.ok) throw new Error(`${role} fehlgeschlagen: ${r.text.slice(-1000)}`); return r.text; }
async function quality(m){
  const results=[]; const pkg=readJson(path.join(root,'package.json'),{}); const scripts=pkg.scripts||{};
  const entries=[['typecheck',cfg.commands.typecheck,true],['lint',cfg.commands.lint,Boolean(scripts.lint)],['test',cfg.commands.test,Boolean(scripts['test:unit']||scripts.test)],['build',cfg.commands.build,true]];
  const edir=path.join(missionDir(root,m.id),'evidence');ensureDir(edir);
  for(const [name,command,required] of entries){
    if(!required){results.push({name,command,required:false,code:0,skipped:true});continue}
    const startedAt=now(); const r=await runShell(command,{cwd:root}); const endedAt=now();
    const item={name,command,required:true,code:r.code,startedAt,endedAt,stdout:r.stdout,stderr:r.stderr};results.push(item);
    writeText(path.join(edir,`${name}.log`),`$ ${command}\n\n${r.stdout}\n${r.stderr}`);
  }
  const report={missionId:m.id,generatedAt:now(),results}; writeJson(path.join(edir,'latest-quality.json'),report);
  appendJsonl(path.join(root,'company','registers','evidence.jsonl'),{missionId:m.id,type:'quality',path:relative(root,path.join(edir,'latest-quality.json')),ok:results.filter(x=>x.required).every(x=>x.code===0),at:now()});
  return report;
}
async function deploy(kind,m){
  const evidence=path.join(missionDir(root,m.id),'evidence');ensureDir(evidence);
  let command=cfg.commands[kind];
  if(command==='auto:vercel'||command==='auto:vercel-prod'){
    if(!(await commandExists('vercel',root))||!fs.existsSync(path.join(root,'.vercel','project.json'))) return {ok:false,external:true,reason:'Vercel CLI oder .vercel/project.json fehlt. Einmalige Vercel-Verknüpfung durch Kontoinhaber erforderlich.'};
    command=kind==='preview'?'vercel --yes':'vercel --prod --yes';
  }
  if(!command) return {ok:false,external:true,reason:`Kein ${kind}-Deploykommando konfiguriert.`};
  const r=await runShell(command,{cwd:root}); writeText(path.join(evidence,`${kind}-deploy.log`),`$ ${command}\n${r.stdout}\n${r.stderr}`);
  const url=(r.stdout+'\n'+r.stderr).match(/https:\/\/[^\s]+/)?.[0]?.replace(/[),.;]+$/,'');
  if(r.code!==0) return {ok:false,external:false,reason:`Deploy fehlgeschlagen: ${r.stderr.slice(-800)}`};
  if(!url) return {ok:false,external:false,reason:'Deploy war erfolgreich, aber keine URL konnte als Beweis extrahiert werden.'};
  let http={ok:false,status:0,error:''};
  try{const res=await fetch(url,{redirect:'follow'});http={ok:res.ok,status:res.status,url:res.url}}catch(e){http={ok:false,status:0,error:String(e)}}
  writeJson(path.join(evidence,`${kind}-http.json`),http);
  return {ok:http.ok,url,http,external:false,reason:http.ok?'':`HTTP-Smoke fehlgeschlagen (${http.status||http.error})`};
}
function nextStabilizationId(){
  const day=new Date().toISOString().slice(0,10).replaceAll('-','');
  const dir=path.join(root,'company','missions');ensureDir(dir);
  const n=fs.readdirSync(dir,{withFileTypes:true}).filter(x=>x.isDirectory()&&x.name.startsWith(`STAB-${day}-`)).length+1;
  return `STAB-${day}-${String(n).padStart(3,'0')}`;
}
function createStabilization(parent,bad){
  const id=nextStabilizationId(),dir=missionDir(root,id);ensureDir(dir);
  const input=`Interne Stabilisierung für ${parent.id}. Projektweite Pflichtgates blockieren Release: ${bad.map(x=>x.name).join(', ')}. Fehler dürfen nicht als pre-existing ignoriert werden. Root Cause beheben, ohne fachfremde Arbeit zu löschen.`;
  const child={id,type:'stabilization',status:'CAPTURED',originalInput:input,stakeholderFeedback:[],parentMissionId:parent.id,createdAt:now(),updatedAt:now(),repairLoops:0,blockers:[],scope:{allowedPaths:cfg.scope.defaultAllowedPaths},artifacts:{},evidence:{},approvals:{targetDesign:true,preview:true}};
  writeJson(missionFile(root,id),child);writeText(path.join(dir,'00_STABILIZATION_INPUT.md'),`# ${id}\n\n${input}\n`);appendJsonl(path.join(root,'company','registers','ideas.jsonl'),{id,type:'stabilization',parentMissionId:parent.id,originalInput:input,at:now(),status:'CAPTURED'});saveMission(root,child);return child;
}
async function continueMission(id){
  let m=loadMission(root,id); setActive(root,id);
  while(true){
    log(`\n[${m.id}] ${m.status}`);
    if(m.status==='CAPTURED') {m.status='DISCOVERY';saveMission(root,m);continue}
    if(m.status==='DISCOVERY'){
      await saveRole('product-strategist',m,'01_PRODUCT_STRATEGY',promptFile('01_DISCOVERY.md'),{model:cfg.models.analysis,maxTurns:cfg.limits.maxTurnsAnalysis});
      m=loadMission(root,id);
      await saveRole('user-researcher',m,'02_USER_RESEARCH',promptFile('01_DISCOVERY.md'),{model:cfg.models.analysis,maxTurns:cfg.limits.maxTurnsAnalysis});
      m=loadMission(root,id);m.status=m.type==='stabilization'?'FEASIBILITY':'TARGET_DESIGN';saveMission(root,m);continue;
    }
    if(m.status==='TARGET_DESIGN'){
      const proto=path.join(missionDir(root,m.id),'prototype','index.html');ensureDir(path.dirname(proto));
      const task=promptFile('02_TARGET_DESIGN.md')+`\nPrototyp-Pfad: ${relative(root,proto)}`;
      await saveRole('product-experience-architect',m,'03_TARGET_DESIGN',task,{write:true,model:cfg.models.design,maxTurns:cfg.limits.maxTurnsBuild});
      if(!fs.existsSync(proto)) writeText(proto,`<!doctype html><meta charset="utf-8"><title>${m.id}</title><main><h1>Prototyp nicht erzeugt</h1><p>Die Product-Experience-Abteilung muss den Prototyp in der Korrekturschleife ergänzen.</p></main>`);
      m=loadMission(root,id);artifact(m,'prototype',relative(root,proto));m=loadMission(root,id);m.status='FEASIBILITY';saveMission(root,m);continue;
    }
    if(m.status==='FEASIBILITY'){
      await saveRole('data-architecture-lead',m,'04_DATA_ARCHITECTURE',promptFile('03_FEASIBILITY.md'),{model:cfg.models.analysis,maxTurns:cfg.limits.maxTurnsAnalysis});
      m=loadMission(root,id);
      await saveRole('security-performance-reviewer',m,'05_SECURITY_PERFORMANCE',promptFile('03_FEASIBILITY.md'),{model:cfg.models.analysis,maxTurns:cfg.limits.maxTurnsAnalysis});
      m=loadMission(root,id);m.status='BOARD_DECISION';saveMission(root,m);continue;
    }
    if(m.status==='BOARD_DECISION'){
      await saveRole('mission-director',m,'06_BOARD_DECISION',promptFile('04_BOARD.md'),{model:cfg.models.analysis,maxTurns:cfg.limits.maxTurnsAnalysis});
      m=loadMission(root,id);
      if(m.type==='stabilization'){m.status='READY_FOR_BUILD';saveMission(root,m);continue}
      m.status='STAKEHOLDER_APPROVAL';saveMission(root,m);setActive(root,'');
      log(`Zielentwurf bereit: ${relative(root,path.join(missionDir(root,id),'prototype','index.html'))}`);log('Stakeholder-Aktion: Freigegeben oder Ändern: ...');return;
    }
    if(m.status==='STAKEHOLDER_APPROVAL'||m.status==='PREVIEW_APPROVAL'||m.status==='BLOCKED_EXTERNAL'||m.status==='LIVE_VERIFIED'||m.status==='REJECTED'){setActive(root,'');return}
    if(m.status==='READY_FOR_BUILD'){m.status='BUILDING';m.scope={allowedPaths:cfg.scope.defaultAllowedPaths};saveMission(root,m);continue}
    if(m.status==='BUILDING'||m.status==='CORRECTION_REQUIRED'){
      const task=(m.status==='CORRECTION_REQUIRED'?promptFile('06_REPAIR.md'):promptFile('05_BUILD.md'))+`\nFreigegebene Board-Entscheidung: ${relative(root,phasePath(m,'06_BOARD_DECISION'))}`;
      await saveRole('product-engineer',m,`07_BUILD_${String(m.repairLoops||0).padStart(2,'0')}`,task,{write:true,model:cfg.models.build,maxTurns:cfg.limits.maxTurnsBuild});
      m=loadMission(root,id);m.status='VERIFYING';saveMission(root,m);continue;
    }
    if(m.status==='VERIFYING'){
      const q=await quality(m); const bad=q.results.filter(x=>x.required&&x.code!==0);
      if(bad.length){
        m=loadMission(root,id);m.repairLoops=(m.repairLoops||0)+1;
        appendJsonl(path.join(root,'company','registers','defects.jsonl'),{missionId:id,at:now(),gates:bad.map(x=>x.name),repairLoop:m.repairLoops});
        if(m.repairLoops>cfg.limits.maxRepairLoops){
          if(m.type!=='stabilization'&&!m.stabilizationMissionId){
            const child=createStabilization(m,bad);m.stabilizationMissionId=child.id;m.status='BLOCKED_BY_CHILD';m.blockers.push({type:'quality',detail:bad.map(x=>x.name).join(', '),childMissionId:child.id,at:now()});saveMission(root,m);setActive(root,child.id);log(`Interne Stabilisierung gestartet: ${child.id}`);return await continueMission(child.id);
          }
          m.status='BLOCKED_INTERNAL';m.blockers.push({type:'quality',detail:bad.map(x=>x.name).join(', '),at:now()});saveMission(root,m);setActive(root,'');log('Interner Blocker nach ausgeschöpfter Reparaturschleife. Keine Live-Freigabe.');return
        }
        m.status='CORRECTION_REQUIRED';saveMission(root,m);continue;
      }
      const qa=await saveRole('qa-red-team',m,'08_QA_RED_TEAM',promptFile('07_VERIFY.md'),{model:cfg.models.verifier,maxTurns:cfg.limits.maxTurnsVerify});
      m=loadMission(root,id);
      const v=await saveRole('independent-verifier',m,'09_INDEPENDENT_VERIFIER',promptFile('07_VERIFY.md'),{model:cfg.models.verifier,maxTurns:cfg.limits.maxTurnsVerify});
      const externalCmd=process.env.COMPANY_EXTERNAL_VERIFIER_CMD;
      if(externalCmd){const ex=await runShell(externalCmd,{cwd:root,env:{COMPANY_MISSION_ID:id}});writeText(phasePath(m,'10_EXTERNAL_VERIFIER'),ex.stdout+'\n'+ex.stderr);if(ex.code!==0){m=loadMission(root,id);m.status='CORRECTION_REQUIRED';m.repairLoops=(m.repairLoops||0)+1;saveMission(root,m);continue}}
      if(!qa.includes('VERDICT: ACCEPT')||!v.includes('VERDICT: ACCEPT')){m=loadMission(root,id);m.status='CORRECTION_REQUIRED';m.repairLoops=(m.repairLoops||0)+1;saveMission(root,m);continue}
      m=loadMission(root,id);
      if(m.type==='stabilization'){
        m.status='COMPLETED_INTERNAL';saveMission(root,m);setActive(root,'');
        if(m.parentMissionId){const parent=loadMission(root,m.parentMissionId);parent.status='CORRECTION_REQUIRED';parent.blockers=(parent.blockers||[]).filter(b=>b.childMissionId!==m.id);saveMission(root,parent);setActive(root,parent.id);return await continueMission(parent.id)}
        return;
      }
      m.status='PREVIEW_DEPLOY';saveMission(root,m);continue;
    }
    if(m.status==='PREVIEW_DEPLOY'){
      await saveRole('release-operations',m,'11_RELEASE_REVIEW',promptFile('08_RELEASE.md'),{model:cfg.models.build,maxTurns:cfg.limits.maxTurnsVerify});
      const d=await deploy('preview',m);
      m=loadMission(root,id);
      if(!d.ok){m.status=d.external?'BLOCKED_EXTERNAL':'CORRECTION_REQUIRED';m.blockers.push({type:d.external?'external':'release',detail:d.reason,at:now()});saveMission(root,m);setActive(root,'');log(d.reason);return}
      m.evidence.previewUrl=d.url;m.status='PREVIEW_APPROVAL';saveMission(root,m);setActive(root,'');log(`Preview bereit: ${d.url}`);log('Stakeholder-Aktion: Freigegeben oder Ändern: ...');return;
    }
    if(m.status==='READY_FOR_RELEASE'){m.status='PRODUCTION_DEPLOY';saveMission(root,m);continue}
    if(m.status==='PRODUCTION_DEPLOY'){
      const d=await deploy('production',m);m=loadMission(root,id);
      if(!d.ok){m.status=d.external?'BLOCKED_EXTERNAL':'CORRECTION_REQUIRED';m.blockers.push({type:d.external?'external':'release',detail:d.reason,at:now()});saveMission(root,m);setActive(root,'');log(d.reason);return}
      m.evidence.productionUrl=d.url;m.status='LIVE_VERIFY';saveMission(root,m);continue;
    }
    if(m.status==='LIVE_VERIFY'){
      await saveRole('independent-verifier',m,'12_LIVE_VERIFICATION',promptFile('08_RELEASE.md')+`\nProduktions-URL: ${m.evidence.productionUrl}`,{model:cfg.models.verifier,maxTurns:cfg.limits.maxTurnsVerify});
      const text=readText(phasePath(m,'12_LIVE_VERIFICATION'));
      if(!text.includes('VERDICT: ACCEPT')){m.status='CORRECTION_REQUIRED';m.repairLoops=(m.repairLoops||0)+1;saveMission(root,m);continue}
      m.status='LIVE_VERIFIED';saveMission(root,m);setActive(root,'');appendJsonl(path.join(root,'company','registers','decisions.jsonl'),{missionId:id,decision:'LIVE_VERIFIED',url:m.evidence.productionUrl,at:now()});log(`LIVE_VERIFIED: ${m.evidence.productionUrl}`);return;
    }
    if(m.status==='BLOCKED_INTERNAL'){m.status='CORRECTION_REQUIRED';saveMission(root,m);continue}
    throw new Error(`Unbekannter Status ${m.status}`);
  }
}

async function main(){
  if(cmd==='doctor'){const r=await run('node',[path.join(root,'company','scripts','company-doctor.mjs')],{cwd:root});process.stdout.write(r.stdout+r.stderr);process.exit(r.code)}
  if(cmd==='idea'){
    let text=val('--text'); if(!text&&!process.stdin.isTTY) text=fs.readFileSync(0,'utf8').trim(); if(!text) throw new Error('Ideentext fehlt');
    const id=nextIdeaId(root),dir=missionDir(root,id);ensureDir(dir);
    const m={id,type:'product',status:'CAPTURED',originalInput:text,stakeholderFeedback:[],parentMissionId:null,createdAt:now(),updatedAt:now(),repairLoops:0,blockers:[],scope:{allowedPaths:[]},artifacts:{},evidence:{},approvals:{targetDesign:false,preview:false}};
    writeJson(missionFile(root,id),m);writeText(path.join(dir,'00_STAKEHOLDER_INPUT.md'),`# ${id}\n\n${text}\n`);appendJsonl(path.join(root,'company','registers','ideas.jsonl'),{id,originalInput:text,at:now(),status:'CAPTURED'});saveMission(root,m);setActive(root,id);log(`Idee aufgenommen: ${id}`);await continueMission(id);return;
  }
  if(cmd==='los'||cmd==='run'||cmd==='resume'){
    const id=args[1]&&!args[1].startsWith('--')?args[1]:activeOrLatest(); if(!id){log('Keine offene Mission. Neue Idee eingeben.');return} await continueMission(id);return;
  }
  if(cmd==='approve'){
    const id=args[1]&&!args[1].startsWith('--')?args[1]:activeOrLatest(); if(!id)throw new Error('Keine Mission'); const m=loadMission(root,id);
    const fromStatus=m.status;
    if(m.status==='STAKEHOLDER_APPROVAL'){m.approvals.targetDesign=true;m.status='READY_FOR_BUILD';}
    else if(m.status==='PREVIEW_APPROVAL'){m.approvals.preview=true;m.status='READY_FOR_RELEASE';}
    else throw new Error(`Mission ${id} wartet nicht auf Freigabe (${m.status})`);
    saveMission(root,m);setActive(root,id);appendJsonl(path.join(root,'company','registers','decisions.jsonl'),{missionId:id,decision:'STAKEHOLDER_APPROVED',from:fromStatus,to:m.status,at:now()});await continueMission(id);return;
  }
  if(cmd==='revise'){
    const id=args[1]&&!args[1].startsWith('--')?args[1]:activeOrLatest(); const text=val('--text'); if(!id||!text)throw new Error('Mission oder Feedback fehlt'); const m=loadMission(root,id);m.stakeholderFeedback.push(text);m.status='TARGET_DESIGN';saveMission(root,m);setActive(root,id);await continueMission(id);return;
  }
  if(cmd==='status'){
    const id=args[1]&&!args[1].startsWith('--')?args[1]:activeOrLatest(); if(id){const m=loadMission(root,id);log(JSON.stringify(m,null,2));return}
    for(const m of listMissions(root)) log(`${m.id}\t${m.status}\t${m.updatedAt}`);return;
  }
  throw new Error(`Unbekannter Befehl: ${cmd}`);
}
main().catch(e=>{console.error(e.stack||e.message);process.exit(1)});
