import 'server-only';
import {sql} from 'drizzle-orm';
import {isAccessArea,type AccessArea} from '@/lib/auth/authorizationContract';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {collectionTaskReferenceMayHaveChanged} from '@/lib/server/dispatchReplyPort';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {HeuteZeile,TagQuelle} from '@/lib/today/todaySourceRegistry';
import {TASK_TAG_COPY} from '@/ui/tasksCopy';
import {TASK_KIND_LABELS,taskUuid,validTaskReference,type TaskKind} from '../contract';
import {liveTaskReadContext,taskReferenceVisible,type TaskReadContext} from './taskService';

export const tagQuellen = [
  {id: 'tasks.aufgabe', modul: 'tasks', bereich: null, rang: null, bestand: {leser: 'tasks', umfang: 'mandant'}},
] as const satisfies readonly TagQuelle[];

const quelleId=tagQuellen[0].id;
type OffeneAufgabe={
 id:string;version:number;bereich:AccessArea|null;titel:string;art:TaskKind;faellig:string;
 bezugTyp:string;bezugId:string|null;kanal:string|null;bezugGeaendert:boolean;
};
type AufgabenFakten={code:'OK';tenantId:string;aufgaben:OffeneAufgabe[]}|{code:'SOURCE_INCOMPLETE'};
type AufgabenZeilen={code:'OK';zeilen:HeuteZeile[]}|{code:'SOURCE_INCOMPLETE'};

function istAufgabenFakt(value:unknown):value is OffeneAufgabe{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const aufgabe=value as Record<string,unknown>;
 return taskUuid(aufgabe.id)&&typeof aufgabe.version==='number'&&Number.isSafeInteger(aufgabe.version)&&aufgabe.version>0
  &&(aufgabe.bereich===null||isAccessArea(aufgabe.bereich))&&typeof aufgabe.titel==='string'&&aufgabe.titel.length>0
  &&typeof aufgabe.art==='string'&&Object.hasOwn(TASK_KIND_LABELS,aufgabe.art)
  &&typeof aufgabe.faellig==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(aufgabe.faellig)
  &&typeof aufgabe.bezugTyp==='string'&&(aufgabe.bezugId===null||validTaskReference({type:aufgabe.bezugTyp,id:aufgabe.bezugId}))
  &&(aufgabe.kanal===null||typeof aufgabe.kanal==='string')&&typeof aufgabe.bezugGeaendert==='boolean';
}

/** A tenant snapshot is projected again with the actual signed-in reader. */
export function projiziereAufgabenFuerTag(auth:AuthorizationSnapshot,value:unknown):AufgabenZeilen{
 if(!value||typeof value!=='object'||!('code'in value)||value.code!=='OK'||!('aufgaben'in value)
    ||!('tenantId'in value)||value.tenantId!==auth.tenantId
    ||!Array.isArray(value.aufgaben)||!value.aufgaben.every(istAufgabenFakt))return {code:'SOURCE_INCOMPLETE'};
 const readAuth=liveTaskReadContext(auth);
 const zeilen=value.aufgaben.filter(eintrag=>readAuth.canReadTaskArea(eintrag.bereich)).map(eintrag=>{
  const {id,version,bezugId,bezugTyp,kanal,bezugGeaendert}=eintrag;
  const bezug={type:bezugTyp,id:bezugId};
  const reference=bezugId!==null&&!bezugGeaendert&&validTaskReference(bezug)&&taskReferenceVisible(readAuth,{type:bezug.type,channel:kanal})
   ?bezug:null;
  return {
   key:`${quelleId}:${id}`,quelleId,gegenstand:eintrag.titel,handlung:TASK_TAG_COPY.oeffnen,
   grund:TASK_KIND_LABELS[eintrag.art],faellig:eintrag.faellig,rang:null,
   ziel:'aufgabe',befehl:'kreile:oeffne',
   bestand:{taskId:id,version,arg:id,reference},
  };
 });
 return {code:'OK',zeilen};
}

/** The existing task window qualifies completion and any newer receipt when it opens. */
export function liesAufgabenFuerTag(auth:AuthorizationSnapshot):Promise<AufgabenZeilen>;
export function liesAufgabenFuerTag(auth:TaskReadContext):Promise<AufgabenFakten>;
export async function liesAufgabenFuerTag(auth:AuthorizationSnapshot|TaskReadContext):Promise<AufgabenZeilen|AufgabenFakten>{
 try{
  const readAuth='canReadArea'in auth?auth:liveTaskReadContext(auth);
  const fakt=await withPrivilegedTenantTransaction(auth,async tx=>{
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
   if(!offene.every(istAufgabenFakt))return {code:'SOURCE_INCOMPLETE' as const};
   return {code:'OK' as const,tenantId:auth.tenantId,aufgaben:offene.filter(eintrag=>readAuth.canReadTaskArea(eintrag.bereich))};
  });
  return 'canReadArea'in auth?fakt:projiziereAufgabenFuerTag(auth,fakt);
 }catch{
  return {code:'SOURCE_INCOMPLETE'};
 }
}
