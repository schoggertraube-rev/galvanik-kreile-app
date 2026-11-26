import 'server-only';
import {berlinCalendarDay,berlinUhrzeit} from '@/lib/domain/workingDays';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {HeuteZeile,TagQuelle} from '@/lib/today/todaySourceRegistry';
import {TAKT_AUSFALL_COPY} from '@/ui/taktCopy';
import {bauePaketAktiv,liesTaktAusfallToleranzInTransaction,TAKT_JOBS} from '../jobs';
import type {TaktJob} from '../public';
import {liesTaktLaufstaendeInTransaction,type TaktLaufstand} from './laeufe';
import {darfTaktNeuStarten} from './geheimnis';

const quelleId='takt.ausfall';
type RegistrierterTaktJob=Omit<TaktJob,'schluessel'>&Pick<(typeof TAKT_JOBS)[number],'schluessel'>;

export const tagQuellen=[{
  id:quelleId,modul:'takt',bereich:null,rang:null,bestand:{leser:'takt_ausfall',umfang:'mandant'},
}] as const satisfies readonly TagQuelle[];

type TaktAusfallFakten = Readonly<{
  schluessel: RegistrierterTaktJob['schluessel'];
  faelligFuer: string;
  laufstand: TaktLaufstand;
}>;
type TaktAusfallLesestand =
  | {code: 'OK'; tenantId:string; ausfaelle: TaktAusfallFakten[]}
  | {code: 'SOURCE_INCOMPLETE'};
type TaktAusfallZeilen={code:'OK';zeilen:HeuteZeile[]}|{code:'SOURCE_INCOMPLETE'};
type TaktLesekontext=Readonly<{tenantId:string}>;
type TaktLogin=Pick<AuthorizationSnapshot,'tenantId'|'permissions'>;

function istGebuchteZeit(value:unknown):boolean{
  return value===null||typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}

function istAusfall(value:unknown):value is TaktAusfallFakten{
  if(!value||typeof value!=='object'||!('schluessel'in value)||typeof value.schluessel!=='string'
     ||!Object.hasOwn(TAKT_AUSFALL_COPY.jobs,value.schluessel)||!('faelligFuer'in value)||typeof value.faelligFuer!=='string'
     ||!('laufstand'in value)||!value.laufstand||typeof value.laufstand!=='object')return false;
  const stand=value.laufstand as Record<string,unknown>;
  return stand.schluessel===value.schluessel&&istGebuchteZeit(stand.letzterErfolgMs)
    &&istGebuchteZeit(stand.letzterTageserfolgMs)&&istGebuchteZeit(stand.letzterAbschlussMs)
    &&(stand.letzterAbschluss===null||stand.letzterAbschluss==='ok'||stand.letzterAbschluss==='fehler'||stand.letzterAbschluss==='abgebrochen');
}

/** Nur fällige, eingeschaltete Jobs zählen. Kalender und letztes echtes Ergebnis bleiben belegt. */
export async function liesTaktAusfallFakten(
  context: Readonly<{tenantId: string}>, jetzt: Date,
): Promise<TaktAusfallLesestand> {
  const {tenantId} = context;
  if (!tenantId || !Number.isFinite(jetzt.getTime())) return {code: 'SOURCE_INCOMPLETE'};
  try {
    const paketAktiv = bauePaketAktiv(tenantId);
    const registriert: readonly RegistrierterTaktJob[]=TAKT_JOBS;
    const jobs: RegistrierterTaktJob[] = [];
    for (const job of registriert) {
      if (job.paket === null || await paketAktiv(job.paket)) jobs.push(job);
    }
    return await withPrivilegedTenantTransaction(context, async tx => {
      const toleranzStunden = await liesTaktAusfallToleranzInTransaction(tx, tenantId);
      if (!Number.isSafeInteger(toleranzStunden) || toleranzStunden <= 0) throw Error('TAKT_AUSFALL_TOLERANZ_FEHLT');
      const schwelle = jetzt.getTime() - toleranzStunden * 60 * 60 * 1000;
      const staende = await liesTaktLaufstaendeInTransaction(tx, tenantId, jobs.map(job => job.schluessel));
      const ausfaelle: TaktAusfallFakten[] = [];
      for (const job of jobs) {
        const laufstand = staende.find(stand => stand.schluessel === job.schluessel);
        if (!laufstand) throw Error('TAKT_AUSFALL_LAUFSTAND_FEHLT');
        const tageserfolg = laufstand.letzterTageserfolgMs === null ? null : new Date(laufstand.letzterTageserfolgMs);
        const faelligFuer = job.faellig(jetzt, tageserfolg);
        if (faelligFuer !== null && (laufstand.letzterErfolgMs === null || laufstand.letzterErfolgMs < schwelle)) {
          ausfaelle.push({schluessel:job.schluessel,faelligFuer,laufstand});
        }
      }
      return {code: 'OK' as const, tenantId, ausfaelle};
    });
  } catch {
    return {code: 'SOURCE_INCOMPLETE'};
  }
}

/** Add the actor's restart right only when presenting a qualified snapshot. */
export function projiziereTaktAusfallZeilen(
  auth: TaktLogin, result: unknown,
):TaktAusfallZeilen {
  if(!result||typeof result!=='object'||!('code'in result)||result.code!=='OK'
     ||!('tenantId'in result)||result.tenantId!==auth.tenantId
     ||!('ausfaelle'in result)||!Array.isArray(result.ausfaelle)||!result.ausfaelle.every(istAusfall))return {code:'SOURCE_INCOMPLETE'};
  const darfNeustart=darfTaktNeuStarten(auth);
  const zeilen=result.ausfaelle.map(({schluessel,laufstand})=>{
    const job=TAKT_AUSFALL_COPY.jobs[schluessel];
    const abschluss=laufstand.letzterAbschluss;
    const erfolg=laufstand.letzterErfolgMs;
    const grund=TAKT_AUSFALL_COPY.gruende[abschluss??'ohneLauf'];
    let zeit: string|null=null;
    if(erfolg!==null){
      const datum=new Date(erfolg);
      const tag=berlinCalendarDay(datum);
      zeit=`${tag.slice(8)}.${tag.slice(5,7)}. ${berlinUhrzeit(datum)}`;
    }
    return {
      key:`${quelleId}:${schluessel}`,quelleId,
      gegenstand:zeit===null?job:TAKT_AUSFALL_COPY.seit(job,zeit),
      handlung:darfNeustart?TAKT_AUSFALL_COPY.neustart(job):TAKT_AUSFALL_COPY.nurSystemdiagnose,grund,
      faellig:null,rang:null,ziel:null,befehl:darfNeustart?'starteTaktJobNeu':null,
      bestand:{schluessel},
    };
  });
  return {code:'OK' as const,zeilen};
}

/** The common model receives facts, the live login receives its own actions. */
export function liesTaktAusfallZeilen(auth:TaktLogin,jetzt:Date):Promise<TaktAusfallZeilen>;
export function liesTaktAusfallZeilen(context:TaktLesekontext,jetzt:Date):Promise<TaktAusfallLesestand>;
export async function liesTaktAusfallZeilen(context:TaktLogin|TaktLesekontext,jetzt:Date):Promise<TaktAusfallZeilen|TaktAusfallLesestand>{
  const fakten=await liesTaktAusfallFakten(context,jetzt);
  return 'permissions'in context?projiziereTaktAusfallZeilen(context,fakten):fakten;
}
