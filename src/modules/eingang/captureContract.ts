import type {CaseActorTrace} from "@/lib/domain/caseActorContract";
import type { IntakeTextRecognition } from "@/lib/server/intakeTextRecognition";
import type { CaptureKind } from "./captureRecognition";

export type IntakeContext = { customerId?: string; orderId?: string };
export type IntakeFileContext = {
  kundeId?: string; auftragId?: string; teilId?: string;
  fotoArt?: 'etikett'|'uebersicht'|'teile'|'abweichung'|'beleg'|'seite'|'sonst';
  phase?: 'eingang'|'arbeit'|'fertig'|'mehrarbeit'|'reklamation';
  fuerKunde?: boolean;
  uebergabeVersion?: number;
};
export function isIntakeFileContext(value:unknown):value is IntakeFileContext {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const fields=value as Record<string,unknown>;
  const id=(entry:unknown)=>typeof entry==='string'&&entry.trim()===entry&&entry.length>0&&entry.length<=128;
  return Object.keys(fields).every(key=>['kundeId','auftragId','teilId','fotoArt','phase','fuerKunde','uebergabeVersion'].includes(key))
    && (fields.kundeId!==undefined||fields.auftragId!==undefined)
    && (fields.kundeId===undefined||id(fields.kundeId)) && (fields.auftragId===undefined||id(fields.auftragId))
    && (fields.teilId===undefined||fields.auftragId!==undefined&&id(fields.teilId))
    && (fields.fotoArt===undefined||['etikett','uebersicht','teile','abweichung','beleg','seite','sonst'].some(art=>art===fields.fotoArt))
    && (fields.phase===undefined||['eingang','arbeit','fertig','mehrarbeit','reklamation'].some(phase=>phase===fields.phase))
    && (fields.fuerKunde===undefined||typeof fields.fuerKunde==='boolean')
    && (fields.uebergabeVersion===undefined||typeof fields.uebergabeVersion==='number'&&Number.isSafeInteger(fields.uebergabeVersion)
      &&fields.uebergabeVersion>0&&fields.auftragId!==undefined&&fields.teilId!==undefined&&fields.fotoArt==='teile'&&fields.phase==='arbeit');
}
export type IntakeOriginalTakeover={sourceId:string;deviceId:string;sha256:string;originalRecord:string};
export function isIntakeOriginalTakeover(value:unknown):value is IntakeOriginalTakeover{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>;
 return Object.keys(row).sort().join(',')==='deviceId,originalRecord,sha256,sourceId'&&typeof row.originalRecord==='string'&&row.originalRecord.length>0&&row.originalRecord.length<=250000&&typeof row.sourceId==='string'&&row.sourceId.length>0&&row.sourceId.length<=512&&typeof row.deviceId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.deviceId)&&typeof row.sha256==='string'&&/^[0-9a-f]{64}$/.test(row.sha256);
}
export type IntakeConcern = import("@/lib/domain/noteConcerns").NoteConcern;
export type IntakeCapture = {
 takeovers?:Array<IntakeOriginalTakeover&{actorId:string;actorName:string;deviceCapturedAt:string|null;sourceCommandId:string|null}>;
 actorTrace?:CaseActorTrace;
  id: string; version: number; text: string | null; customerId: string | null;
  orderId: string | null; assignment: string; usage: string; concerns: string[];
  continuation?: { sourceId: string | null; childIds: string[]; textSourceId?: string | null };
  dismissedConcerns?: string[];
  openConcerns?: string[];
  recognition?: { kind: CaptureKind; text: string; source?: "hand" };
  packageContext?: {status:"OK";customers:Array<{customerId:string;customerName:string;lastAt:string;source:"order"|"quote"}>;candidates:Array<{kind:"quote"|"order";id:string;number:string;state:"accepted"|"pending"|"waiting"|"rework";customerId:string;customerName?:string;edition?:number;goodsHere?:boolean;location?:string|null}>;ambiguous:boolean;moreCandidates:boolean}|{status:"UNAVAILABLE";message:string};
  expectedOrders?: Array<{ id: string; number: string; customerId: string; customerName: string | null; title: string | null; since: string | null; reason?:"rework"|"waiting" }>;
  files: Array<{ id: string; name: string; mime: string; bytes: number; readable: boolean; status: string; secured?: boolean; errorCode?: string | null; captureOrigin?: "warenfoto" | "dokument"; recognizedText?: string | null }>;
  suggestions?: Array<{ id:string; fileId:string|null; orderId:string|null; field:string; value:unknown; confidence:string; rule:string|null; reason:string|null; source:unknown; status:string; verifiedBy?:string|null; verifiedAt?:string|null }>;
};
export type IntakeCaptureResult = { code: "OK"; capture: IntakeCapture }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE"; message: string };
export type EingangVorschlagOption={vorschlagId:string;knopf:string;satz:string;grund:string;kunde:string};
export type EingangVorschlag={
  satz:string|null;haupt:EingangVorschlagOption|null;oder:readonly EingangVorschlagOption[];
  frage:{satz:string;kandidaten:EingangVorschlagOption[]}|null;anliegenRest:readonly string[];
};
export type EingangVorschlagResult={code:'OK';vorschlag:EingangVorschlag}|{code:'CONFLICT';message:string;vorschlag?:EingangVorschlag}|
  {code:'UNAUTHENTICATED'|'FORBIDDEN'|'VALIDATION_ERROR'|'NOT_FOUND'|'UNAVAILABLE'|'INVOICE_REVIEW_REQUIRED';message:string};
export type IntakeNoteInput = {
  itemId: string; textstand: string; text: string; context?: IntakeContext; concerns?: string[]; expectedVersion?:number; deviceCapturedAt?:string;takeover?:IntakeOriginalTakeover;
};
export type IntakeNoteReading = { recognition: IntakeTextRecognition; concerns: IntakeConcern[] };
export type IntakeFileInput = { itemId: string; fileId: string; name: string; mime: string; bytes: number; sha256: string; deviceId?: string; deviceCapturedAt?:string; captureOrigin?: "warenfoto" | "dokument";takeover?:IntakeOriginalTakeover;kontext?:IntakeFileContext };
export type IntakeFileGrant = { code: "OK"; upload: { bucket: string; path: string; token: string; url: string } | null }
  | Exclude<IntakeCaptureResult, { code: "OK" }>;

export {recognizeNoteConcerns} from "@/lib/domain/noteConcerns";
