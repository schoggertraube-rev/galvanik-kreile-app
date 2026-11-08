import type {AccessArea} from '@/lib/auth/authorizationContract';
import {berlinCalendarDay,workingDaysBetween} from '@/lib/domain/workingDays';
import type {Complaint} from './contract';

export type ComplaintAttention={key:string;complaintId:string;orderId:string;title:string;meta:string;urgency:'conflict'|'decision'|'warning';actionLabel:string;target:{screen:'reklamation'|'mail';arg:string}};
/** Derived entirely from the shared stored complaint projection, never another task row. */
export function complaintAttention(rows:readonly Complaint[],areas:readonly AccessArea[],today=berlinCalendarDay()):ComplaintAttention[] {
  const items:ComplaintAttention[]=[];
  for(const row of rows){
    if(!row.stand||row.stand==='abgeschlossen')continue;
    const order=row.orderNumber??'Auftragsnummer fehlt',customer=row.customerName??'Kundenname fehlt',defect=row.mangel??'Mangel fehlt';
    const clock=new Date(row.createdAt),since=Number.isFinite(clock.getTime())?berlinCalendarDay(clock):null,days=since?workingDaysBetween(since,today):null,age=days===null?'Aufnahmedatum fehlt':`seit ${days} Tagen`,overdue=days!==null&&days>10;
    const add=(caseId:string,title:string,meta:string,urgency:ComplaintAttention['urgency'],actionLabel:string,target:ComplaintAttention['target']={screen:'reklamation',arg:row.id})=>items.push({key:caseId+':'+row.id,complaintId:row.id,orderId:row.orderId,title,meta,urgency,actionLabel,target});
    if(row.stand==='aufgenommen'&&areas.includes('entscheiden'))add('reklamation_entscheiden',`Reklamation ${order} · ${defect} · Ergebnis festlegen`,`${customer} · ${defect} · ${age}`,'decision','Ergebnis festlegen');
    if(row.stand==='massnahme_gutschrift'&&areas.includes('geld'))add('reklamation_gutschrift',`Gutschrift ${row.gutschriftBetrag?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(row.gutschriftBetrag)):'Betrag fehlt'} · ${customer}`,`Reklamation ${order}`,'decision','Gutschrift erteilen');
    if(row.stand==='kunde_informieren'&&areas.includes('kunden'))add('reklamation_informieren',`Reklamation ${order} · Kunde informieren`,`${customer} · ${row.bewertung??'Bewertung fehlt'}`,'warning','Kunde informieren');
    if(row.stand==='massnahme_nacharbeit'&&row.reworkGoods==='erwartet'&&row.reworkGoodsSince&&row.nacharbeitAuftragId&&areas.includes('kunden')){
      const waiting=workingDaysBetween(berlinCalendarDay(new Date(row.reworkGoodsSince)),today);
      if(waiting!==null&&waiting>=10){
        const sent=row.goodsReminderSentAt?new Date(row.goodsReminderSentAt):null;
        const sentDay=sent&&Number.isFinite(sent.getTime())?berlinCalendarDay(sent):null;
        const quiet=sentDay?workingDaysBetween(sentDay,today):null;
        if(quiet!==null&&quiet<5)continue;
        const afterReminder=quiet!==null&&quiet>=5;
        add('nacharbeit_ware_fehlt',`Nacharbeit · Ware fehlt seit ${waiting} Tagen`+(afterReminder?' · erinnert am '+sent!.toLocaleDateString('de-DE',{timeZone:'Europe/Berlin'}):''),`Reklamation ${row.nummer??'Nummer fehlt'} · ${customer}`,'warning',afterReminder&&areas.includes('auftraege')?'Reklamation öffnen':'Kunde erinnern',afterReminder&&areas.includes('auftraege')?{screen:'reklamation',arg:row.id}:{screen:'mail',arg:row.nacharbeitAuftragId+'#auftragsbestaetigung'});continue;
      }
    }
    if(row.stand==='massnahme_nacharbeit'&&areas.includes('entscheiden'))add('reklamation_laeuft',overdue?`Reklamation ${order} seit ${days} Tagen offen`:`Reklamation ${order} · Nacharbeit läuft`,`${customer} · ${defect} · ${age} · ${row.reworkNumber??'Nacharbeitsnummer fehlt'} ${row.reworkStation??'Station fehlt'}`,overdue?'conflict':'warning','Öffnen');
  }
  return items;
}
