"use server";

import { unstable_noStore as noStore } from "next/cache";
import { resolveAuthorization } from "@/lib/server/authorization";
import { attachIntakeDraftAttachment, finalizeDomainAttachment, getDomainAttachmentOriginal, reserveDomainAttachment } from "@/lib/server/domainAttachment";
import { readEvidenceRecordsByTarget,readEvidenceVisibilityByKeys } from "@/lib/server/evidenceRead";
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {EVIDENCE_READ_COPY} from '@/ui/situationCatalog';
import { analyzeDomainAttachment } from "@/lib/server/documentIntelligencePort";
import { readAzureDocumentIntelligenceStatus } from "@/lib/server/azureDocumentIntelligence";
import { readOrderIntakeOriginals } from "@/modules/eingang/server-public";
import {changeEvidenceVisibility} from '@/lib/server/evidenceVisibilityCommand';

async function authorization() {
  try {
    const result = await resolveAuthorization();
    if (!result.ok) return { ok: false as const, code: result.reason === "AUTHORIZATION_UNAVAILABLE" ? "UNAVAILABLE" as const : "UNAUTHENTICATED" as const };
    return { ok: true as const, data: result.data };
  } catch {
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
}

export async function reserveDomainAttachmentAction(input: Parameters<typeof reserveDomainAttachment>[1]) {
  const auth = await authorization();
  return auth.ok ? reserveDomainAttachment(auth.data, input) : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function finalizeDomainAttachmentAction(input: Parameters<typeof finalizeDomainAttachment>[1]) {
  const auth = await authorization();
  return auth.ok ? finalizeDomainAttachment(auth.data, input) : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function setEvidenceVisibilityAction(input:Parameters<typeof changeEvidenceVisibility>[1]){
  const auth=await authorization();
  return auth.ok?changeEvidenceVisibility(auth.data,input):{code:auth.code,message:EVIDENCE_READ_COPY.unavailable};
}

export async function attachIntakeDraftAttachmentAction(input: Parameters<typeof attachIntakeDraftAttachment>[1]) {
  const auth = await authorization();
  return auth.ok ? attachIntakeDraftAttachment(auth.data, input) : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function getDomainAttachmentsAction(input: { targetType: "CUSTOMER" | "ORDER"; targetId: string }) {
  noStore();
  const auth = await authorization();
  if (!auth.ok) return { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  const result = await readEvidenceRecordsByTarget(auth.data, input);
  if (result.code !== "OK") return result;
  const originals=input.targetType==='ORDER'?await readOrderIntakeOriginals(input.targetId):null;
  if(originals&&originals.code!=='OK')return originals;
  let intakeVisibility:Awaited<ReturnType<typeof readEvidenceVisibilityByKeys>>|null=null;
  try{
    intakeVisibility=await withPrivilegedTenantTransaction(auth.data,tx=>readEvidenceVisibilityByKeys(tx,auth.data,
      originals?.code==='OK'?originals.originals.map(original=>'intake-file:'+original.id):[]));
  }catch{
    // R11(g): the already-read original list survives a metadata read failure.
    // Null is explicitly unknown, never an inferred customer release.
    console.error('[EVIDENCE_VISIBILITY_READ_UNAVAILABLE]');
  }
  return {
    code: "OK" as const,
    dataGaps:intakeVisibility===null?['evidence.visibility']:[],
    ...(intakeVisibility===null?{message:EVIDENCE_READ_COPY.unavailable}:{}),
    data: [...result.data.filter((record) => record.source === "LEGACY_SCAN_UPLOAD" && record.original.state === "LEGACY_RECORDED").map((record) => ({
      attachmentId: record.sourceId,
      mimeType: record.original.mimeType,
      fileBytes: record.original.sizeBytes,
      recordedAt: record.recordedAt,
      visibility: record.visibility,
    })),...(originals?.code==='OK'?originals.originals.map(original=>({attachmentId:original.id,mimeType:original.mime,fileBytes:original.bytes,
      recordedAt:original.at,visibility:intakeVisibility?.get('intake-file:'+original.id)??null,intakeOriginal:true as const,intakeItemId:original.itemId,intakeName:original.name,intakePart:original.part,intakeTotal:original.total,intakeSecured:original.secured})):[])],
  };
}

export async function getDomainAttachmentOriginalAction(input: { attachmentId: string }) {
  noStore();
  const auth = await authorization();
  return auth.ok ? getDomainAttachmentOriginal(auth.data, input) : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}

export async function getDocumentIntelligenceStatusAction() {
  noStore();
  const auth = await authorization();
  if (!auth.ok) return { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  return readAzureDocumentIntelligenceStatus().code === "READY"
    ? { code: "OK" as const }
    : { code: "IN_KLAERUNG" as const, message: "Azure Document Intelligence · In Klärung." };
}

export async function analyzeDomainAttachmentAction(input: Parameters<typeof analyzeDomainAttachment>[1]) {
  const auth = await authorization();
  return auth.ok ? analyzeDomainAttachment(auth.data, input) : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
}
