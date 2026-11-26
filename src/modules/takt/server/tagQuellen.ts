import 'server-only';
import {berlinCalendarDay,berlinUhrzeit} from '@/lib/domain/workingDays';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {TAKT_AUSFALL_COPY} from '@/ui/taktCopy';
import {bauePaketAktiv,liesTaktAusfallToleranzInTransaction,TAKT_JOBS} from '../jobs';
import type {TaktJob} from '../public';
import {liesTaktLaufstaendeInTransaction,type TaktLaufstand} from './laeufe';
import {darfTaktNeuStarten} from './geheimnis';

const quelleId='takt.ausfall';
type RegistrierterTaktJob=Omit<TaktJob,'schluessel'>&Pick<(typeof TAKT_JOBS)[number],'schluessel'>;

export const tagQuellen=[{
  id:quelleId,modul:'takt',bereich:null,rang:null,bestand:{leser:'takt_ausfall',umfang:'mandant'},
}] as const;

type TaktAusfallFakten = Readonly<{
  schluessel: RegistrierterTaktJob['schluessel'];
  faelligFuer: string;
  laufstand: TaktLaufstand;
}>;

/** Nur fällige, eingeschaltete Jobs zählen. Kalender und letztes echtes Ergebnis bleiben belegt. */
export async function liesTaktAusfallFakten(
  context: Readonly<{tenantId: string}>, jetzt: Date,
): Promise<{code: 'OK'; ausfaelle: TaktAusfallFakten[]} | {code: 'SOURCE_INCOMPLETE'}> {
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
      return {code: 'OK' as const, ausfaelle};
    });
  } catch {
    return {code: 'SOURCE_INCOMPLETE'};
  }
}

/** Use the same real outage for the row and the authorized restart. */
export async function liesTaktAusfallZeilen(auth: Pick<AuthorizationSnapshot,'tenantId'|'permissions'>, jetzt: Date) {
  const result=await liesTaktAusfallFakten(auth,jetzt);
  if(result.code!=='OK')return result;
  const darfNeustart=darfTaktNeuStarten(auth);
  const zeilen=result.ausfaelle.map(({schluessel,laufstand})=>{
    const job=TAKT_AUSFALL_COPY.jobs[schluessel];
    const abschluss=laufstand.letzterAbschluss;
    const erfolg=laufstand.letzterErfolgMs;
    const grund=abschluss==='ok'?'':TAKT_AUSFALL_COPY.gruende[abschluss??'ohneLauf'];
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
