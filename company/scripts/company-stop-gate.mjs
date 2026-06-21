import { findRoot,getActive,loadMission } from './lib.mjs';
if(process.env.COMPANY_RUNNER_CHILD==='1') process.exit(0);
const root=findRoot(); const id=getActive(root); if(!id) process.exit(0); let m; try{m=loadMission(root,id)}catch{process.exit(0)}
const safe=['STAKEHOLDER_APPROVAL','PREVIEW_APPROVAL','BLOCKED_EXTERNAL','LIVE_VERIFIED','COMPLETED_INTERNAL','REJECTED'];
if(safe.includes(m.status)) process.exit(0);
process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'Stop',permissionDecision:'deny',permissionDecisionReason:`Mission ${id} steht auf ${m.status}. Interne Arbeit fortsetzen: node company/scripts/company-runner.mjs resume ${id}`}}));
