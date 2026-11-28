import 'server-only';
import {sql} from 'drizzle-orm';
import {berlinCalendarDay,berlinUhrzeit,isWorkingDay,plusWorkingDays,workingDaysBetween} from '@/lib/domain/workingDays';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {HeuteZeile,TagQuelle} from '@/lib/today/todaySourceRegistry';
import {eingangCopy} from '@/ui/eingangCopy';

const offen='eingang.offen', gegen='eingang.gegenvorschlag', unklar='eingang.unklar';

export const tagQuellen = [
  {id: 'eingang.nachrichten', modul: 'eingang', bereich: null, rang: null, bestand: {leser: 'messages', umfang: 'mandant'}},
  {id:offen,modul:'eingang',bereich:'eingang',rang:null,bestand:{leser:'eingang_offen',umfang:'mandant'}},
  {id:gegen,modul:'eingang',bereich:'mails',rang:null,bestand:{leser:'eingang_gegenvorschlag',umfang:'mandant'}},
  {id:unklar,modul:'eingang',bereich:'eingang',rang:null,bestand:{leser:'eingang_unklar',umfang:'mandant'}},
] as const satisfies readonly TagQuelle[];

function arbeitsstunden(seit:Date,jetzt:Date,ruhe:ReadonlySet<string>){
  if(!Number.isFinite(seit.getTime())||seit>jetzt)return null;
  const start=berlinCalendarDay(seit),ende=berlinCalendarDay(jetzt);
  const tage=workingDaysBetween(start,ende,ruhe);
  if(tage===null)return null;
  const stunden=(clock:Date)=>{const [h,m]=berlinUhrzeit(clock).split(':').map(Number);return h+m/60;};
  return tage*24
    +(isWorkingDay(start,ruhe)?24-stunden(seit):0)
    -(isWorkingDay(ende,ruhe)?24-stunden(jetzt):0);
}

type TagEinstellungen={liegefrist:number;nachfassfrist:number;schwelle:number|null;ruhe:ReadonlySet<string>};
type EingangFakt={id:string;kanal:string;gruppe:string|null;seit:string|null;betreff:string|null;sicherheit:boolean};

export async function liesEingangTagZeilenInTransaction(tx:PrivilegedTenantTransaction,tenantId:string,
  jetzt:Date,settings:TagEinstellungen):Promise<HeuteZeile[]>{
  const [{liegefrist,nachfassfrist,schwelle,ruhe},heute]=[settings,berlinCalendarDay(jetzt)] as const;
  if(!Number.isSafeInteger(liegefrist)||liegefrist<1||!Number.isSafeInteger(nachfassfrist)||nachfassfrist<0)
    throw Error('I2_TAG_FRISTEN_FEHLEN');
  const fakten=await tx.execute<EingangFakt>(sql`
    SELECT item.id::text,item.kanal,item.gruppe_adresse AS gruppe,item.wartet_seit::text AS seit,item.betreff,
      EXISTS(SELECT 1 FROM public.intake_suggestion s WHERE s.tenant_id=item.tenant_id
        AND s.item_id=item.id AND s.status='offen'
        AND (s.sicherheit='unsicher' OR s.sicherheit_wert<${schwelle}::numeric)) AS sicherheit
    FROM public.intake_item item WHERE item.tenant_id=${tenantId} AND item.richtung='rein'
      AND item.einsatz='offen' AND item.aussortiert IS NULL ORDER BY item.wartet_seit NULLS LAST,item.id`);
  const termine=await tx.execute<{id:string;nummer:string;gruppe:string|null;gesendet:string}>(sql`
    SELECT DISTINCT ON (v.id) v.id,v.nummer,mail.gruppe_adresse AS gruppe,mail.gesendet_am::text AS gesendet
    FROM public.v_eingang_vorgaenge_v1 v JOIN public.intake_item mail ON mail.tenant_id=${tenantId}
      AND mail.vorgang_id=v.id AND mail.vorgang_art=v.art AND mail.richtung='raus' AND mail.kanal='mail'
    WHERE v.term_status='gegenvorschlag' AND mail.gesendet_am IS NOT NULL
    ORDER BY v.id,mail.gesendet_am DESC,mail.id`);
  const zeilen:HeuteZeile[]=[], kanaele=new Set<string>();
  const ziel=(gruppe:string|null)=>gruppe?'/nachrichten?gruppe='+encodeURIComponent(gruppe):null;
  for(const fakt of fakten){
    const label=fakt.betreff?.trim()||eingangCopy.tag.eingang;
    const seit=fakt.seit?new Date(fakt.seit):null;
    const stunden=seit===null?null:arbeitsstunden(seit,jetzt,ruhe);
    if(stunden!==null&&stunden>=liegefrist&&!kanaele.has(fakt.kanal)){
      kanaele.add(fakt.kanal);
      const tage=Math.floor((jetzt.getTime()-seit!.getTime())/86400000);
      zeilen.push({key:offen+':'+fakt.kanal,quelleId:offen,gegenstand:label,handlung:eingangCopy.tag.offen,
        grund:tage>=2?eingangCopy.tag.seit(tage):eingangCopy.tag.wartet,faellig:null,rang:null,ziel:ziel(fakt.gruppe),befehl:null});
    }
    if(fakt.sicherheit)zeilen.push({key:unklar+':'+fakt.id,quelleId:unklar,gegenstand:label,
      handlung:eingangCopy.tag.unklar,grund:eingangCopy.tag.unsicher,faellig:null,rang:null,ziel:ziel(fakt.gruppe),befehl:null});
  }
  for(const termin of termine){
    const gesendet=new Date(termin.gesendet);
    if(!Number.isFinite(gesendet.getTime()))throw Error('I2_TAG_MAILZEIT_FEHLT');
    const faellig=plusWorkingDays(berlinCalendarDay(gesendet),nachfassfrist,ruhe);
    if(faellig&&faellig<=heute)zeilen.push({key:gegen+':'+termin.id,quelleId:gegen,
      gegenstand:termin.nummer,handlung:eingangCopy.tag.nachfassen,grund:eingangCopy.tag.gegenvorschlag,
      faellig,rang:null,ziel:ziel(termin.gruppe),befehl:null});
  }
  return zeilen;
}
