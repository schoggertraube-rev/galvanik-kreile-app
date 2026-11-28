"use server";

import {observeAction,subjectForAction} from '@/modules/logging/server-public';
import {readErkennungsEinstellungenInTransaction,readLoggingSettings} from '@/modules/fundament/server-public';
import { unstable_noStore as noStore } from "next/cache";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import { attachIntakeDraftAttachment, finalizeDomainAttachment, getDomainAttachmentOriginal, reserveDomainAttachment } from "@/lib/server/domainAttachment";
import { readEvidenceRecordsByTarget,readEvidenceVisibilityByKeys } from "@/lib/server/evidenceRead";
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {EVIDENCE_READ_COPY} from '@/ui/situationCatalog';
import { analyzeDomainAttachment } from "@/lib/server/documentIntelligencePort";
import { readAzureDocumentIntelligenceStatus } from "@/lib/server/azureDocumentIntelligence";
import { readDomainIntakeOriginals } from "@/modules/eingang/server-public";
import {changeEvidenceVisibility} from '@/lib/server/evidenceVisibilityCommand';
import {splitUploadVisibility} from '@/lib/domain/evidenceVisibility';
import {applyEvidenceUploadVisibility,type UploadVisibilityResult} from '@/lib/server/evidenceVisibilityUpload';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {EVIDENCE_VISIBILITY_COPY} from '@/ui/situationCatalog';

async function finishUploadedEvidenceVisibility(auth:AuthorizationSnapshot,key:string,requested:boolean|undefined){
  return applyEvidenceUploadVisibility(auth,key,requested,{synchronizeTask:async(tx,actor,id)=>{
    const [{synchronizeEvidenceVisibilityRetryTask},{recordIntakeTaskEffect},{readCustomerProfile}]=await Promise.all([
      import('@/modules/tasks/server-public'),import('@/modules/eingang/server-public'),import('@/modules/customers/server-public')]);
    return synchronizeEvidenceVisibilityRetryTask(tx,actor,id,
      {effect:(writeTx,writer,effect)=>recordIntakeTaskEffect(writeTx,writer,effect,readCustomerProfile)});
  }});
}

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
 return observeAction('reserveDomainAttachmentAction',subjectForAction('reserveDomainAttachmentAction',input),async()=>{
  const auth = await authorization();
  return auth.ok ? reserveDomainAttachment(auth.data, input) : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };

 },readLoggingSettings);
}

export async function finalizeDomainAttachmentAction(input: Parameters<typeof finalizeDomainAttachment>[1]) {
 return observeAction('finalizeDomainAttachmentAction',subjectForAction('finalizeDomainAttachmentAction',input),async()=>{
  const option=splitUploadVisibility(input);
  if(!option.valid)return {code:'VALIDATION_ERROR' as const,message:EVIDENCE_VISIBILITY_COPY.invalid};
  const auth = await authorization();
  if(!auth.ok)return {code:auth.code,message:EVIDENCE_READ_COPY.unavailable};
  const result=await finalizeDomainAttachment(auth.data,option.base);
  if(result.code!=='OK')return result;
  const flag=await finishUploadedEvidenceVisibility(auth.data,'legacy-scan-upload:'+result.data.receipt.attachmentId,option.requested);
  return flag.code==='OK'?{...result,data:{...result.data,visibilityPending:flag.visibilityPending,...(flag.visibility?{visibility:flag.visibility}:{})}}:flag;

 },readLoggingSettings);
}

type UploadVisibilityInput={mode:'upload';evidenceKey:string;customerVisible?:boolean};
type VisibilityActionFailure={code:'UNAUTHENTICATED'|'UNAVAILABLE'|'VALIDATION_ERROR';message:string};
export async function setEvidenceVisibilityAction(input:UploadVisibilityInput):Promise<UploadVisibilityResult|VisibilityActionFailure>;
export async function setEvidenceVisibilityAction(input:Parameters<typeof changeEvidenceVisibility>[1]):Promise<Awaited<ReturnType<typeof changeEvidenceVisibility>>|VisibilityActionFailure>;
export async function setEvidenceVisibilityAction(input:unknown):Promise<UploadVisibilityResult|Awaited<ReturnType<typeof changeEvidenceVisibility>>|VisibilityActionFailure>{
 return observeAction('setEvidenceVisibilityAction',subjectForAction('setEvidenceVisibilityAction',input),async()=>{
  const auth=await authorization();
  if(!auth.ok)return {code:auth.code,message:EVIDENCE_READ_COPY.unavailable};
  if(input&&typeof input==='object'&&!Array.isArray(input)&&'mode'in input&&input.mode==='upload'){
    const value=input as UploadVisibilityInput,keys=Object.keys(value).sort().join(',');
    if(!['evidenceKey,mode','customerVisible,evidenceKey,mode'].includes(keys)||typeof value.evidenceKey!=='string'||!value.evidenceKey.trim()||value.evidenceKey.length>256
      ||Object.hasOwn(value,'customerVisible')&&typeof value.customerVisible!=='boolean')return {code:'VALIDATION_ERROR' as const,message:EVIDENCE_VISIBILITY_COPY.invalid};
    return finishUploadedEvidenceVisibility(auth.data,value.evidenceKey,value.customerVisible);
  }
  return changeEvidenceVisibility(auth.data,input);

 },readLoggingSettings);
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
  const originals=input.targetType==='ORDER'||hasAuthorizationArea(auth.data,'kunden')
    ?await readDomainIntakeOriginals(input.targetType,input.targetId):null;
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
      recordedAt:original.at,visibility:intakeVisibility?.get('intake-file:'+original.id)??null,intakeOriginal:true as const,intakeItemId:original.itemId,intakeName:original.name,intakePart:original.part,intakeTotal:original.total,intakeSecured:original.secured})):[])]
      .sort((left,right)=>Date.parse(right.recordedAt)-Date.parse(left.recordedAt)),
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
 return observeAction('analyzeDomainAttachmentAction',subjectForAction('analyzeDomainAttachmentAction',input),async()=>{
  const auth = await authorization();
  return auth.ok ? analyzeDomainAttachment(auth.data, input, readErkennungsEinstellungenInTransaction)
    : { code: auth.code, message: "Sitzung oder Berechtigung ist nicht verfügbar." };
 },readLoggingSettings);
}
