import type {CaseActorTrace} from "@/lib/server/quoteJournalPort";
import type { IntakeTextRecognition } from "@/lib/server/intakeTextRecognition";
import type { CaptureKind } from "./captureRecognition";

export type IntakeContext = { customerId?: string; orderId?: string };
export type IntakeConcern = { id: string; label: string };
export type IntakeCapture = {
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
  itemId: string; textstand: string; text: string; context?: IntakeContext; concerns?: string[];
};
export type IntakeNoteReading = { recognition: IntakeTextRecognition; concerns: IntakeConcern[] };
export type IntakeFileInput = { itemId: string; fileId: string; name: string; mime: string; bytes: number; sha256: string; deviceId?: string; captureOrigin?: "warenfoto" | "dokument" };
export type IntakeFileGrant = { code: "OK"; upload: { bucket: string; path: string; token: string; url: string } | null }
  | Exclude<IntakeCaptureResult, { code: "OK" }>;

// The signal vocabulary is eingang.anliegen in the frozen AP-EIN specification.
const NOTE_SIGNALS = [
  { id: "rueckruf", label: "Rückruf", pattern: /ruft zurück|rückruf|zurückrufen|bitte anrufen|rufen sie mich|melden sie sich|mailbox|call back/iu },
  { id: "frist", label: "Frist", pattern: /frist|bis zum|spätestens|mahnung|bescheid|behörde|widerspruch/iu },
  { id: "aufgabe", label: "Aufgabe (intern)", pattern: /\bbitte\b|erledigen|kannst du|maschine|störung/iu },
  { id: "hinweis", label: "Hinweis zur Bearbeitung", pattern: /bitte beachten|abdecken|\bnur\b|verpacken|vorsicht|maskieren|sie hatten|wie besprochen/iu },
  { id: "preis_einwand", label: "Preis klären", pattern: /preis passt nicht|zu teuer|rechnung stimmt nicht/iu },
  { id: "nachfrage", label: "Nachfrage", pattern: /teile fertig|stand der teile/iu },
  { id: "kundendaten", label: "Kundendaten", pattern: /rechnung an|rechnungs.?e.?mail/iu },
] as const;
const NEGATED_SIGNAL = /\b(?:nicht|kein|keine|keinen|entfällt|erledigt|ohne|bereits|schon)\b/iu;
export function recognizeNoteConcerns(text: string): IntakeConcern[] {
  const sentences=text.split(/[.!?;\n]+/u);
  return NOTE_SIGNALS.filter(signal=>sentences.some(sentence=>{
    const match=signal.pattern.exec(sentence);if(!match)return false;
    if(signal.id==="aufgabe"&&(NEGATED_SIGNAL.test(sentence)||/\bnur\b|zurückrufen|anrufen|rufen sie mich|rechnung an/iu.test(sentence)))return false;
    return !NEGATED_SIGNAL.test(sentence.slice(0,match.index));
  })).map(({id,label})=>({id,label}));
}
