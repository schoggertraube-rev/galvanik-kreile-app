import type {IntakeCapture,IntakeCaptureResult} from './captureContract';

/** The concern identifiers and rights from eingang.anliegen in the bound R52 contract. */
export const INTAKE_CONCERN_AREAS={reklamation:['auftraege'],kv_annahme:['geld'],kv_ablehnung:['kunden','geld'],termin:['auftraege'],zahlung:['geld'],abholung:['auftraege'],nachfrage:['kunden'],
 kv_anfrage:['eingang'],rechnung:['geld'],rueckruf:[],frist:[],aufgabe:[],aenderung:['auftraege'],hinweis:['auftraege'],ware:['eingang'],abholung_durch:['eingang'],preis_einwand:['geld'],kundendaten:['kunden']} as const;
export type IntakeSelectableConcern=keyof typeof INTAKE_CONCERN_AREAS;
export function intakeInvoiceReviewRequired(concerns:readonly string[],kind:string|null,id:string|null){return concerns.includes('rechnung')&&!(kind==='rechnung'&&id);}
export type IntakeSelectionInput={itemId:string;version:number;clientEventId:string;concern:IntakeSelectableConcern};
export type IntakeUseInput={items:Array<{itemId:string;version:number}>;clientEventId:string;kind:'info'|'erledigt';note:string|null};
export type IntakeReopenInput={itemId:string;version:number;clientEventId:string;reason:string};
export type IntakeUseResult={code:'OK';captures:IntakeCapture[]}|{code:'INVOICE_REVIEW_REQUIRED';itemId:string;message:string}|Exclude<IntakeCaptureResult,{code:'OK'}>;

/** A pending business decision must be completed by its existing domain writer. */
export const INTAKE_REQUIRED_EFFECT_COPY={kv_annahme:'Zusage zum KV übernehmen',kv_ablehnung:'Absage zum KV übernehmen',kv_vorbehalt:'KV-Vorbehalt klären',preis_einwand:'KV-Vorbehalt klären',reklamation:'Reklamation bearbeiten',termin:'Termin abstimmen'} as const;
export function intakeRequiredEffect(concerns:readonly string[]){for(const concern of concerns)if(Object.hasOwn(INTAKE_REQUIRED_EFFECT_COPY,concern))return INTAKE_REQUIRED_EFFECT_COPY[concern as keyof typeof INTAKE_REQUIRED_EFFECT_COPY];return null;}
