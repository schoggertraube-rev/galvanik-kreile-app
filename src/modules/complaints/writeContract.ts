import type { ComplaintState } from './contract';

export const COMPLAINT_DEFECTS = ['Abplatzung', 'Blasen', 'Rost / Korrosion', 'Farbe / Glanz', 'Maß / Gewinde', 'Transportschaden', 'Sonstiges'] as const;
type Identity = { clientKey: string; complaintId: string; version: number };
export type ComplaintCommand =
  | { action: 'aufnehmen'; clientKey: string; orderId: string; intakeItemId: string | null; intakeVersion: number | null; parts: Array<{ position_id: string; menge: number }>; defect: string; description: string; photoIds: string[]; goodsReturn: 'ja' | 'nein' | 'offen' }
  | (Identity & {action:'fotoantwort_anhaengen';intakeItemId:string;intakeVersion:number})
  | (Identity & { action: 'entscheiden'; assessment: 'berechtigt' | 'kulanz' | 'abgelehnt'; measure: 'gutschrift' | 'ablehnen'; reason: string | null; creditCents: number | null })
  | (Identity & { action: 'gutschrift'; creditCents: number; creditNumber: string })
  | (Identity & { action: 'abschliessen'; kind: 'ohne_mail' | 'zurueckgezogen' | 'mail'; note: string | null; sentThreadId: string | null })
  | (Identity & { action: 'wieder_oeffnen'; reason: string });
export type ComplaintWriteResult =
  | { code: 'OK'; receipt: { complaintId: string; number: string; state: ComplaintState; version: number; eventId: string }; replayed: boolean }
  | { code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'UNAVAILABLE'; message: string;delivery?:'checking'|'failed'|'source-changed';retryAt?:string;deliveryCustomer?:string;sentThreadId?:string };

export const complaintUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value.trim() === value && value.length >= min && value.length <= max;
const cents = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 9_999_999_999;

/** Shared shape contract; domain references and delivered quantities are checked on the server. */
export function validComplaintCommand(input: unknown): input is ComplaintCommand {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const v = input as Record<string, unknown>;
  if (!complaintUuid(v.clientKey)) return false;
  const keys = (expected: string[]) => Object.keys(v).sort().join(',') === expected.sort().join(',');
  if (v.action === 'aufnehmen') return keys(['action','clientKey','orderId','intakeItemId','intakeVersion','parts','defect','description','photoIds','goodsReturn'])
    && text(v.orderId, 1, 128) && (v.intakeItemId === null && v.intakeVersion === null || complaintUuid(v.intakeItemId) && Number.isSafeInteger(v.intakeVersion) && Number(v.intakeVersion) > 0)
    && Array.isArray(v.parts) && v.parts.length > 0 && v.parts.length <= 20
    && v.parts.every(p => p && typeof p === 'object' && Object.keys(p).sort().join(',') === 'menge,position_id' && text(p.position_id,1,128) && Number.isFinite(p.menge) && p.menge >= 1)
    && new Set(v.parts.map(p => p.position_id)).size === v.parts.length
    && COMPLAINT_DEFECTS.includes(v.defect as typeof COMPLAINT_DEFECTS[number])
    && typeof v.description === 'string' && v.description.length <= 4000 && Array.isArray(v.photoIds) && v.photoIds.length >= 1 && v.photoIds.length <= 20 && v.photoIds.every(p => text(p,1,128))
    && ['ja','nein','offen'].includes(String(v.goodsReturn));
  if (!text(v.complaintId,1,128) || !Number.isSafeInteger(v.version) || Number(v.version) < 1) return false;
  const identity = ['action','clientKey','complaintId','version'];
  if(v.action==='fotoantwort_anhaengen')return keys([...identity,'intakeItemId','intakeVersion'])&&complaintUuid(v.intakeItemId)&&Number.isSafeInteger(v.intakeVersion)&&Number(v.intakeVersion)>0;
  if (v.action === 'entscheiden') return keys([...identity,'assessment','measure','reason','creditCents']) && ['berechtigt','kulanz','abgelehnt'].includes(String(v.assessment))
    && (v.assessment === 'abgelehnt' ? v.measure === 'ablehnen' && text(v.reason,3,2000) && v.creditCents === null : v.measure === 'gutschrift' && (v.reason === null || text(v.reason,0,2000)) && (v.creditCents === null || cents(v.creditCents)));
  if (v.action === 'gutschrift') return keys([...identity,'creditCents','creditNumber']) && cents(v.creditCents) && text(v.creditNumber,1,30);
  if (v.action === 'abschliessen') return keys([...identity,'kind','note','sentThreadId']) && (v.kind === 'mail' ? complaintUuid(v.sentThreadId) && v.note === null : ['ohne_mail','zurueckgezogen'].includes(String(v.kind)) && text(v.note,3,500) && v.sentThreadId === null);
  return v.action === 'wieder_oeffnen' && keys([...identity,'reason']) && text(v.reason,3,200);
}
