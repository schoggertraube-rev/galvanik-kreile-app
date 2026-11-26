import 'server-only';
import {sql} from 'drizzle-orm';
import {canReadTaskArea,isAccessArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {authorizationReadContext} from '@/lib/server/authorizationReadContext';
import {collectionTaskReferenceMayHaveChanged} from '@/lib/server/dispatchReplyPort';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {TASK_TAG_COPY} from '@/ui/tasksCopy';
import {TASK_KIND_LABELS,type TaskKind,type TaskReferenceType} from '../contract';
import {taskReferenceVisible} from './taskService';

const quelleId='tasks.aufgabe';
type OffeneAufgabe={
 id:string;version:number;bereich:string|null;titel:string;art:TaskKind;faellig:string;
 bezugTyp:TaskReferenceType;bezugId:string|null;kanal:string|null;bezugGeaendert:boolean;
};

/** The existing task window qualifies completion and any newer receipt when it opens. */
export async function liesAufgabenFuerTag(auth:AuthorizationSnapshot){
 try{
  return await withPrivilegedTenantTransaction(auth,async tx=>{
   const offene=await tx.execute<OffeneAufgabe>(sql`
    SELECT task.id::text,task.version,task.fuer_bereich AS bereich,task.titel,task.art,
      task.faellig_am::text AS faellig,task.bezug_typ AS "bezugTyp",
      bezug.id AS "bezugId",bezug.channel AS kanal,
      CASE WHEN task.bezug_typ='auftrag' THEN
        ${collectionTaskReferenceMayHaveChanged(auth.tenantId,sql`task.id::text`)}
        ELSE false END AS "bezugGeaendert"
    FROM public.tasks task
    LEFT JOIN LATERAL (
      SELECT min(ref.id) AS id,min(ref.channel) AS channel
      FROM private.v_task_contexts_v1 ref
      WHERE ref.tenant_id=task.tenant_id AND ref.id=task.bezug_id AND ref.label IS NOT NULL
        AND ref.kind=CASE WHEN task.bezug_typ='lagerbestand' THEN 'lagerartikel' ELSE task.bezug_typ END
      HAVING count(*)=1
    ) bezug ON true
    WHERE task.tenant_id=${auth.tenantId} AND task.status='offen'
    ORDER BY task.faellig_am,task.id`);
   const readAuth=authorizationReadContext(auth);
   const zeilen=[];
   for(const eintrag of offene){
    if(eintrag.bereich!==null&&!isAccessArea(eintrag.bereich))throw Error('TAG_AUFGABEN_BEREICH_UNBEKANNT');
    if(!canReadTaskArea(auth,eintrag.bereich))continue;
    const {id,version,bezugId,bezugTyp,kanal,bezugGeaendert}=eintrag;
    const reference=bezugId&&!bezugGeaendert&&taskReferenceVisible(readAuth,{type:bezugTyp,channel:kanal})
     ?{type:bezugTyp,id:bezugId}:null;
    zeilen.push({
     key:`${quelleId}:${id}`,quelleId,gegenstand:eintrag.titel,handlung:TASK_TAG_COPY.oeffnen,
     grund:TASK_KIND_LABELS[eintrag.art],faellig:eintrag.faellig,rang:null,
     ziel:'aufgabe',befehl:'kreile:oeffne',
     bestand:{taskId:id,version,arg:id,reference},
    });
   }
   return {code:'OK' as const,zeilen};
  });
 }catch{
  return {code:'SOURCE_INCOMPLETE' as const};
 }
}
