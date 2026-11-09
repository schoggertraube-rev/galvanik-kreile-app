import type {IntakeCapture,IntakeCaptureResult} from './captureContract';
import {INTAKE_PENDING_WORKFLOW_COPY} from '@/ui/situationCatalog';

/** The concern identifiers and rights from eingang.anliegen in the bound R52 contract. */
export const INTAKE_CONCERN_AREAS={reklamation:['auftraege'],kv_annahme:['geld'],kv_ablehnung:['kunden','geld'],termin:['auftraege'],zahlung:['geld'],abholung:['auftraege'],nachfrage:['kunden'],
 kv_anfrage:['eingang'],rechnung:['geld'],rueckruf:[],frist:[],aufgabe:[],aenderung:['auftraege'],hinweis:['auftraege'],ware:['eingang'],abholung_durch:['eingang'],preis_einwand:['geld'],kundendaten:['kunden']} as const;
export type IntakeSelectableConcern=keyof typeof INTAKE_CONCERN_AREAS;

/** A conservative shared directive; contradictory instructions never choose a mode. */
export function intakeHandoverDirective(text:string){
 const normalized=text.toLocaleLowerCase('de-DE').replace(/\s+/gu,' ');
 if(/\b(?:nicht|kein|keine|keinen|falls|wenn|vielleicht|könnte|koennte)\b/u.test(normalized)||/^\s*>/mu.test(text)||/(?:\bam .{1,100} schrieb\b|\b(?:from|von):)/iu.test(text))return null;
 const pickup=/\b(?:hole(?:n)? (?:ich|wir|sie) (?:es |das |die (?:ware|teile) )?(?:selbst )?ab|ich hole (?:es |das |die (?:ware|teile) )?ab|abholen|abholung)\b/u.test(normalized);
 const shipping=/\b(?:versenden|verschicken|versand|zusenden)\b/u.test(normalized);
 if(pickup===shipping)return null;
 return {mode:pickup?'pickup' as const:'shipping' as const,forFuture:/\bab jetzt immer\b|\bkuenftig immer\b|\bkünftig immer\b/u.test(normalized)};
}
export function intakeInvoiceReviewRequired(concerns:readonly string[],kind:string|null,id:string|null){return concerns.includes('rechnung')&&!(kind==='rechnung'&&id);}
export type IntakeSelectionInput={itemId:string;version:number;clientEventId:string;concern:IntakeSelectableConcern};
export type IntakeUseInput={items:Array<{itemId:string;version:number}>;clientEventId:string;kind:'info'|'erledigt';note:string|null};
export type IntakeReopenInput={itemId:string;version:number;clientEventId:string;reason:string};
export type IntakeUseResult={code:'OK';captures:IntakeCapture[]}|{code:'INVOICE_REVIEW_REQUIRED';itemId:string;message:string}|Exclude<IntakeCaptureResult,{code:'OK'}>;

/** A pending business decision must be completed by its existing domain writer. */
export const INTAKE_REQUIRED_EFFECT_COPY={kv_anfrage:INTAKE_PENDING_WORKFLOW_COPY.quoteRequest,kv_annahme:'Zusage zum KV übernehmen',kv_ablehnung:'Absage zum KV übernehmen',kv_vorbehalt:'KV-Vorbehalt klären',preis_einwand:'KV-Vorbehalt klären',reklamation:'Reklamation bearbeiten',termin:'Termin abstimmen'} as const;
export function intakeRequiredEffect(concerns:readonly string[]){for(const concern of concerns)if(Object.hasOwn(INTAKE_REQUIRED_EFFECT_COPY,concern))return INTAKE_REQUIRED_EFFECT_COPY[concern as keyof typeof INTAKE_REQUIRED_EFFECT_COPY];return null;}
