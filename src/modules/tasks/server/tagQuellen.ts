import 'server-only';
import {sql} from 'drizzle-orm';
import {canReadTaskArea,isAccessArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {TASK_TAG_COPY} from '@/ui/tasksCopy';
import {TASK_KIND_LABELS} from '../contract';
import {presentTaskSource,readTaskSourceInTransaction} from './taskService';

const quelleId='tasks.aufgabe';

/** Keep the assignee's actual completion and reference rights on the task seam. */
export async function liesAufgabenFuerTag(auth:AuthorizationSnapshot){
 try{
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const offene=await tx.execute<{id:string;version:number;bereich:string|null}>(sql`
    SELECT id::text,version,fuer_bereich AS bereich FROM public.tasks
    WHERE tenant_id=${auth.tenantId} AND status='offen' ORDER BY faellig_am,id`);
   const zeilen=[];
   for(const eintrag of offene){
    if(eintrag.bereich!==null&&!isAccessArea(eintrag.bereich))throw Error('TAG_AUFGABEN_BEREICH_UNBEKANNT');
    if(!canReadTaskArea(auth,eintrag.bereich))continue;
    const quelle=await readTaskSourceInTransaction(tx,auth,{taskId:eintrag.id});
    const gelesen=presentTaskSource(auth,quelle);
    const {task,reference,canOpenReference,canComplete,completeLabel}=gelesen;
    const unvollstaendig=[gelesen.collectionSource,gelesen.pricingSource,gelesen.creditSource,
     gelesen.invoiceFollowupSource,gelesen.reissueSource].includes('SOURCE_INCOMPLETE');
    if(!task||task.status!=='offen'||task.version!==eintrag.version||unvollstaendig){
     throw Error('TAG_AUFGABEN_QUELLE_UNVOLLSTAENDIG');
    }
    zeilen.push({
     key:`${quelleId}:${task.id}`,quelleId,gegenstand:task.titel,
     handlung:canComplete?(completeLabel??TASK_TAG_COPY.erledigen):TASK_TAG_COPY.ansehen,
     grund:TASK_KIND_LABELS[task.art],faellig:task.faellig_am,rang:null,
     ziel:canOpenReference?reference.id:null,befehl:canComplete?'completeTask':null,
     bestand:{taskId:task.id,version:task.version,reference:canOpenReference?{type:reference.type,id:reference.id}:null},
    });
   }
   return {code:'OK' as const,zeilen};
  });
 }catch{
  return {code:'SOURCE_INCOMPLETE' as const};
 }
}
