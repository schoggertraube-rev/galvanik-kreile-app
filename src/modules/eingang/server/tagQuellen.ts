import 'server-only';
import {sql} from 'drizzle-orm';
import {berlinCalendarDay,berlinUhrzeit,isWorkingDay,plusWorkingDays,workingDaysBetween} from '@/lib/domain/workingDays';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {TagQuelle} from '@/lib/today/todaySourceRegistry';
import type {EingangTagFakt} from '../messageContract';
import {priceTaskReceipt} from './intakePriceTaskReceipt';

const offen='eingang.offen', gegen='eingang.gegenvorschlag', unklar='eingang.unklar';

export const tagQuellen = [
  {id: 'eingang.nachrichten', modul: 'eingang', bereich: null, rang: null, bestand: {leser: 'messages', umfang: 'mandant'}},
  {id:offen,modul:'eingang',bereich:'mails',rang:null},
  {id:gegen,modul:'eingang',bereich:'mails',rang:null},
  {id:unklar,modul:'eingang',bereich:'mails',rang:null},
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
type EingangFakt={id:string;kanal:string;gruppe:string|null;seit:string|null;betreff:string|null;sicherheit:boolean;preisgeschuetzt:boolean};

export async function liesEingangTagFaktenInTransaction(tx:PrivilegedTenantTransaction,tenantId:string,
  jetzt:Date,settings:TagEinstellungen):Promise<EingangTagFakt[]>{
  const [{liegefrist,nachfassfrist,schwelle,ruhe},heute]=[settings,berlinCalendarDay(jetzt)] as const;
  if(!Number.isSafeInteger(liegefrist)||liegefrist<1||!Number.isSafeInteger(nachfassfrist)||nachfassfrist<0)
    throw Error('I2_TAG_FRISTEN_FEHLEN');
  const fakten=await tx.execute<EingangFakt>(sql`
    SELECT item.id::text,item.kanal,item.gruppe_adresse AS gruppe,item.wartet_seit::text AS seit,item.betreff,
      EXISTS (${priceTaskReceipt('item')}) AS preisgeschuetzt,
      EXISTS(SELECT 1 FROM public.intake_suggestion s WHERE s.tenant_id=item.tenant_id
        AND s.item_id=item.id AND s.status='offen'
        AND (s.sicherheit='unsicher' OR s.sicherheit_wert<${schwelle}::numeric)) AS sicherheit
    FROM public.intake_item item WHERE item.tenant_id=${tenantId} AND item.richtung='rein'
      AND item.einsatz='offen' AND item.aussortiert IS NULL ORDER BY item.wartet_seit NULLS LAST,item.id`);
  const termine=await tx.execute<{id:string;nummer:string;gruppe:string|null;gesendet:string;preisgeschuetzt:boolean}>(sql`
    SELECT DISTINCT ON (v.id) v.id,v.nummer,mail.gruppe_adresse AS gruppe,mail.gesendet_am::text AS gesendet,
      EXISTS (${priceTaskReceipt('mail')}) AS preisgeschuetzt
    FROM public.v_eingang_vorgaenge_v1 v JOIN public.intake_item mail ON mail.tenant_id=${tenantId}
      AND mail.vorgang_id=v.id AND mail.vorgang_art=v.art AND mail.richtung='raus' AND mail.kanal='mail'
    WHERE v.term_status='gegenvorschlag' AND mail.gesendet_am IS NOT NULL
    ORDER BY v.id,mail.gesendet_am DESC,mail.id`);
  const ergebnis:EingangTagFakt[]=[];
  for(const fakt of fakten){
    const {id,kanal,gruppe,betreff,preisgeschuetzt}=fakt;
    const seit=fakt.seit?new Date(fakt.seit):null;
    const stunden=seit===null?null:arbeitsstunden(seit,jetzt,ruhe);
    const grund={id,kanal,gruppe,betreff,preisgeschuetzt,tage:0,faellig:null};
    if(seit&&stunden!==null&&stunden>=liegefrist)
      ergebnis.push({...grund,art:'offen',tage:Math.floor((jetzt.getTime()-seit.getTime())/86400000)});
    if(fakt.sicherheit)ergebnis.push({...grund,art:'unklar'});
  }
  for(const termin of termine){
    const gesendet=new Date(termin.gesendet);
    if(!Number.isFinite(gesendet.getTime()))throw Error('I2_TAG_MAILZEIT_FEHLT');
    const faellig=plusWorkingDays(berlinCalendarDay(gesendet),nachfassfrist,ruhe);
    if(faellig&&faellig<=heute)ergebnis.push({art:'gegenvorschlag',id:termin.id,kanal:'mail',gruppe:termin.gruppe,
      betreff:termin.nummer,preisgeschuetzt:termin.preisgeschuetzt,tage:0,faellig});
  }
  return ergebnis;
}
