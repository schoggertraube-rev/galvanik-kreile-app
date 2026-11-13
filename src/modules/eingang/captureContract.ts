import type {CaseActorTrace} from "@/lib/domain/caseActorContract";
import type { IntakeTextRecognition } from "@/lib/server/intakeTextRecognition";
import type { CaptureKind } from "./captureRecognition";

export type IntakeContext = { customerId?: string; orderId?: string };
export type IntakeOriginalTakeover={sourceId:string;deviceId:string;sha256:string;originalRecord:string};
export function isIntakeOriginalTakeover(value:unknown):value is IntakeOriginalTakeover{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const row=value as Record<string,unknown>;
 return Object.keys(row).sort().join(',')==='deviceId,originalRecord,sha256,sourceId'&&typeof row.originalRecord==='string'&&row.originalRecord.length>0&&row.originalRecord.length<=250000&&typeof row.sourceId==='string'&&row.sourceId.length>0&&row.sourceId.length<=512&&typeof row.deviceId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(row.deviceId)&&typeof row.sha256==='string'&&/^[0-9a-f]{64}$/.test(row.sha256);
}
export type IntakeConcern = import("@/lib/domain/noteConcerns").NoteConcern;
export type IntakeCapture = {
 takeovers?:Array<IntakeOriginalTakeover&{actorId:string;actorName:string}>;
 actorTrace?:CaseActorTrace;
  id: string; version: number; text: string | null; customerId: string | null;
  orderId: string | null; assignment: string; usage: string; concerns: string[];
  continuation?: { sourceId: string | null; childIds: string[]; textSourceId?: string | null };
  dismissedConcerns?: string[];
  openConcerns?: string[];
  recognition?: { kind: CaptureKind; text: string; source?: "hand" };
  packageContext?: {status:"OK";customers:Array<{customerId:string;customerName:string;lastAt:string;source:"order"|"quote"}>;candidates:Array<{kind:"quote"|"order";id:string;number:string;state:"accepted"|"pending"|"waiting"|"rework";customerId:string;customerName?:string;edition?:number;goodsHere?:boolean;location?:string|null}>;ambiguous:boolean;moreCandidates:boolean}|{status:"UNAVAILABLE";message:string};
  expectedOrders?: Array<{ id: string; number: string; customerId: string; customerName: string | null; title: string | null; since: string | null; reason?:"rework"|"waiting" }>;
  files: Array<{ id: string; name: string; mime: string; bytes: number; readable: boolean; status: string; secured?: boolean; errorCode?: string | null; captureOrigin?: "warenfoto" | "dokument" }>;
  suggestions?: Array<{ id:string; fileId:string|null; orderId:string|null; field:string; value:unknown; confidence:string; rule:string|null; reason:string|null; source:unknown; status:string; verifiedBy?:string|null; verifiedAt?:string|null }>;
};
export type IntakeCaptureResult = { code: "OK"; capture: IntakeCapture }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "UNAVAILABLE"; message: string };
export type IntakeCaptureKindInput = { itemId: string; version: number; clientEventId: string; kind: Exclude<CaptureKind, "unklar"> };
export type IntakeNoteInput = {
  itemId: string; textstand: string; text: string; context?: IntakeContext; concerns?: string[]; expectedVersion?:number; deviceCapturedAt?:string;takeover?:IntakeOriginalTakeover;
};
export type IntakeNoteReading = { recognition: IntakeTextRecognition; concerns: IntakeConcern[] };
export type IntakeFileInput = { itemId: string; fileId: string; name: string; mime: string; bytes: number; sha256: string; deviceId?: string; deviceCapturedAt?:string; captureOrigin?: "warenfoto" | "dokument";takeover?:IntakeOriginalTakeover };
export type IntakeFileGrant = { code: "OK"; upload: { bucket: string; path: string; token: string; url: string } | null }
  | Exclude<IntakeCaptureResult, { code: "OK" }>;

export {recognizeNoteConcerns} from "@/lib/domain/noteConcerns";
