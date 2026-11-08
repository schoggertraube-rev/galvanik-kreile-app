import type {AccessArea} from '@/lib/auth/authorizationContract';
import type {IconName} from '@/ui/kr';
import {INTAKE_CONCERN_AREAS,type IntakeSelectableConcern} from './intakeLifecycleContract';
import type {IntakeMessage} from './messageContract';
type Context='order'|'openOrder'|'quote'|'goods'|'invoice'|'letter'|'internal'|'any';
export type ConcernOption={concern:IntakeSelectableConcern;id:string;text:string;icon:IconName;target:string;context:Context};
/** Labels/targets are the one bound eingang.anliegen vocabulary used by M6 and the conversation. */
export const CONCERN_OPTIONS:readonly ConcernOption[]=[
 {concern:'reklamation',id:'reklamation_aufnehmen',text:'Reklamation aufnehmen',icon:'alert',target:'reklamation',context:'order'},
 {concern:'kv_annahme',id:'kv_annehmen',text:'Zusage übernehmen · Ware erwartet',icon:'check',target:'auftrag',context:'quote'},
 {concern:'kv_ablehnung',id:'kv_absage',text:'Absage vermerken',icon:'x',target:'kv_absage',context:'quote'},
 {concern:'termin',id:'termin_aendern',text:'Termin ändern',icon:'calendar',target:'termin',context:'openOrder'},
 {concern:'zahlung',id:'zahlung_pruefen',text:'Zahlung zuordnen',icon:'euro',target:'zahlung',context:'order'},
 {concern:'abholung',id:'abholung_eintragen',text:'Übergabe eintragen',icon:'truck',target:'termin',context:'openOrder'},
 {concern:'nachfrage',id:'status_senden',text:'Status senden',icon:'mail',target:'status_senden',context:'openOrder'},
 {concern:'kv_anfrage',id:'kv_erstellen',text:'Auftrag oder KV erfassen',icon:'inbox',target:'eingang',context:'any'},
 {concern:'rechnung',id:'rechnungein',text:'Eingangsrechnung erfassen',icon:'receipt',target:'rechnungein',context:'invoice'},
 {concern:'rueckruf',id:'rueckruf_anlegen',text:'Rückruf anlegen',icon:'phone',target:'aufgabe',context:'any'},
 {concern:'frist',id:'frist_anlegen',text:'Frist anlegen',icon:'calendar',target:'aufgabe',context:'letter'},
 {concern:'aufgabe',id:'aufgabe_anlegen',text:'Aufgabe anlegen',icon:'check',target:'aufgabe',context:'internal'},
 {concern:'aenderung',id:'auftrag_aendern',text:'Auftrag ändern',icon:'edit',target:'auftrag',context:'openOrder'},
 {concern:'hinweis',id:'hinweis_uebernehmen',text:'Als Hinweis übernehmen',icon:'alert',target:'hinweis',context:'openOrder'},
 {concern:'ware',id:'ware_annehmen',text:'Ware annehmen',icon:'box',target:'ware',context:'goods'},
];
export function concernOptions(row:IntakeMessage,areas:readonly AccessArea[]){
 const order=row.orderKind==='auftrag'&&row.orderId!==null,open=order&&!['abgeschlossen','storniert','archiviert'].includes(row.orderStation??'');
 const match:Record<Context,boolean>={any:true,order,openOrder:open,quote:row.orderKind==='kv'&&row.orderId!==null,
  goods:open&&(row.goods==='erwartet'||row.goods==='teilweise'),invoice:row.customerType==='lieferant'||row.concerns.includes('rechnung'),letter:row.concerns.includes('frist'),internal:row.channel==='notiz'&&row.direction==='intern'};
 const reasons:Record<Context,string>={any:'',order:'braucht einen Auftrag',openOrder:'braucht einen offenen Auftrag',quote:'braucht einen offenen KV',goods:'braucht einen Auftrag mit erwarteter Ware',invoice:'braucht einen Lieferanten oder eine erkannte Rechnung',letter:'braucht eine Brief- oder Fristsache',internal:'braucht eine interne Notiz'};
 return CONCERN_OPTIONS.filter(option=>INTAKE_CONCERN_AREAS[option.concern].every(area=>areas.includes(area))).map(option=>({...option,reason:match[option.context]||option.concern==='abholung'&&row.channel==='mail'&&row.customerId!==null?null:reasons[option.context]}));
}
