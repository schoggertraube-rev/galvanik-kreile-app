import type {IntakeCapture,IntakeCaptureResult} from './captureContract';

/** The concern identifiers and rights from eingang.anliegen in the bound R52 contract. */
export const INTAKE_CONCERN_AREAS={reklamation:['auftraege'],kv_annahme:['geld'],kv_ablehnung:['kunden','geld'],termin:['auftraege'],zahlung:['geld'],abholung:['auftraege'],nachfrage:['kunden'],
 kv_anfrage:['eingang'],rechnung:['geld'],rueckruf:[],frist:[],aufgabe:[],aenderung:['auftraege'],hinweis:['auftraege'],ware:['eingang'],abholung_durch:['eingang'],preis_einwand:['geld'],kundendaten:['kunden']} as const;
export type IntakeSelectableConcern=keyof typeof INTAKE_CONCERN_AREAS;
export type IntakeSelectionInput={itemId:string;version:number;clientEventId:string;concern:IntakeSelectableConcern};
export type IntakeUseInput={items:Array<{itemId:string;version:number}>;clientEventId:string;kind:'info'|'erledigt';note:string|null};
export type IntakeReopenInput={itemId:string;version:number;clientEventId:string;reason:string};
export type IntakeUseResult={code:'OK';captures:IntakeCapture[]}|{code:'INVOICE_REVIEW_REQUIRED';itemId:string;message:string}|Exclude<IntakeCaptureResult,{code:'OK'}>;
