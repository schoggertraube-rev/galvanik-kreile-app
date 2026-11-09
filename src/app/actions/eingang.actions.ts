"use server";
import {PACKAGE_ASSIGN_COPY} from "@/ui/situationCatalog";
import {quoteOperationContext,canReadQuoteForGoods} from "@/lib/server/quoteAuthorization";

import {listOpenQuotesCommand,readPackageQuoteHistory} from '@/modules/quotes/server-public';
import {readPackageOrderCustomers} from '@/modules/orders/server-public';
import type {PackageCustomerHistory} from '@/lib/server/packageIntakeContextPort';
import {readPackageExpectation} from '@/modules/eingang/server-public';
import type {IntakeCaptureResult} from '@/modules/eingang/public';
async function withPackageExpectation(result:IntakeCaptureResult):Promise<IntakeCaptureResult>{
 if(result.code!=='OK'||result.capture.recognition?.kind!=='ware')return result;
 try{
  const auth=await resolveAuthorization();if(!auth.ok)return result;
  const quoteContext=quoteOperationContext(auth.data);
  const canReadExpected=canReadQuoteForGoods(auth.data);
  const quotes=canReadExpected?await listOpenQuotesCommand(quoteContext,result.capture.customerId??undefined):null;
  const history=!result.capture.customerId?await readPackageQuoteHistory(auth.data,result.capture.recognition?.text??result.capture.text??''):[];
  result.capture.packageContext=await withPrivilegedTenantTransaction(auth.data,async tx=>{
   const orderHistory:PackageCustomerHistory[]=[];
   if(!result.capture.customerId)for(const row of await readPackageOrderCustomers(tx,auth.data,result.capture.recognition?.text??result.capture.text??'')){const customer=await readCustomerProfile(tx,auth.data.tenantId,row.customerId);if(customer)orderHistory.push({...row,customerName:customer.name,source:'order'});}
   return readPackageExpectation(tx,auth.data,result.capture,quotes,history,orderHistory);
  });
 }catch(error){console.error('[PACKAGE_EXPECTATION_READ_FAILED]',error);result.capture.packageContext={status:'UNAVAILABLE',message:PACKAGE_ASSIGN_COPY.unavailable};}
 return result;
}

import { createHash } from "node:crypto";
import { after } from "next/server";
import {revalidatePath} from "next/cache";
import { getAppSession } from "@/lib/server/appSession";
import {readIntakeMessages} from '@/modules/eingang/server-public';
export async function getIntakeMessagesAction(filter:unknown='offen'){return readIntakeMessages(filter);}
import {readIntakeAssignment,assignIntakeCustomer,setIntakeNoBusiness,createCustomerForIntake} from '@/modules/eingang/server-public';
export async function getIntakeAssignmentAction(input:unknown){return readIntakeAssignment(input,readCustomerProfile);}
export async function assignIntakeCustomerAction(input:unknown){return assignIntakeCustomer(input,readCustomerProfile);}
export async function setIntakeNoBusinessAction(input:unknown){return setIntakeNoBusiness(input);}
export async function createCustomerForIntakeAction(input:unknown){return createCustomerForIntake(input,createCustomerInTransaction,readCustomerProfile);}
import {selectIntakeConcern,finishIntakeUse,reopenIntake} from '@/modules/eingang/server-public';
export async function selectIntakeConcernAction(input:unknown){return selectIntakeConcern(input);}
export async function finishIntakeUseAction(input:unknown){return finishIntakeUse(input);}
export async function reopenIntakeAction(input:unknown){return reopenIntake(input);}
import {saveTask,completeTask,readTask,createMissingGoodsTask,type TaskEffectRequest} from '@/modules/tasks/server-public';
import type {TaskOpenRequest} from '@/modules/tasks/public';
import {recordIntakeTaskEffect} from '@/modules/eingang/server-public';
import {withPrivilegedTenantTransaction,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
const taskEffects={effect:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:TaskEffectRequest)=>recordIntakeTaskEffect(tx,auth,input,readCustomerProfile)};
import {createInvoiceClarificationTask,resolveInvoiceClarificationTask} from '@/modules/tasks/server-public';
import {readIncomingInvoice,saveIncomingInvoice,changeIncomingInvoice,readInvoiceTaskContext} from '@/modules/eingang/server-public';
import {searchOrderIntakeCustomers} from '@/lib/server/orderIntakeRead';
const invoiceTaskEffects={...taskEffects,readInvoice:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,id:string)=>readInvoiceTaskContext(tx,auth,id,readCustomerProfile)};
const invoiceEffects={readCustomer:readCustomerProfile,updateCustomer:updateCustomerInTransaction,
 createTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;clientKey:string;reason:string})=>createInvoiceClarificationTask(tx,auth,input,invoiceTaskEffects),
 resolveTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{invoiceId:string;taskId:string;note:string})=>resolveInvoiceClarificationTask(tx,auth,input,invoiceTaskEffects)};
export async function getIncomingInvoiceAction(input:unknown){return readIncomingInvoice(input,invoiceEffects);}
export async function saveIncomingInvoiceAction(input:unknown){return saveIncomingInvoice(input,invoiceEffects);}
export async function changeIncomingInvoiceStatusAction(input:unknown){return changeIncomingInvoice(input,invoiceEffects);}
export async function clarifyIncomingInvoiceAction(input:unknown){return changeIncomingInvoice(input,invoiceEffects,true);}
/** Supplier selection uses the same canonical customer search and stored profiles. */
export async function searchInvoiceSuppliersAction(query:string){
 const auth=await resolveAuthorization();if(!auth.ok)return {code:'UNAUTHENTICATED' as const,message:'Sitzung nicht verfügbar.'};
 if(!hasAuthorizationArea(auth.data,'geld'))return {code:'FORBIDDEN' as const,message:'Recht Geld fehlt.'};
 if(typeof query!=='string'||query.length>200)return {code:'VALIDATION_ERROR' as const,message:'Suchtext ist ungültig.'};
 try{
  const candidates=await searchOrderIntakeCustomers(auth.data,{query});
  const suppliers=await withPrivilegedTenantTransaction(auth.data,async tx=>{
   const values=[];for(const candidate of candidates){if(candidate.customerType!=='lieferant')continue;const value=await readCustomerProfile(tx,auth.data.tenantId,candidate.id);if(value)values.push({id:value.id,name:value.name,iban:value.iban,paymentTermDays:value.paymentTermDays});}return values;
  });return {code:'OK' as const,suppliers};
 }catch(error){console.error('[INVOICE_SUPPLIER_SEARCH_FAILED]',{code:error instanceof Error?error.name:'INVOICE_SUPPLIER_SEARCH_FAILED'});return {code:'UNAVAILABLE' as const,message:'Lieferantensuche nicht verfügbar · Fehlercode: INVOICE_SUPPLIER_SEARCH_FAILED.'};}
}
const goodsEffects={createMissingTask:(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,input:{orderId:string;missing:string[];clientKey:string})=>createMissingGoodsTask(tx,auth,input,taskEffects)};
export async function saveIntakeTaskAction(input:unknown){return saveTask(input,taskEffects);}
export async function completeIntakeTaskAction(input:unknown){return completeTask(input,taskEffects);}
export async function getIntakeTaskAction(input:TaskOpenRequest){return readTask(input);}
import {readOpenIntakeMails} from '@/modules/eingang/server-public';
import {saveIntakeProspect} from '@/modules/eingang/server-public';
export async function saveIntakeProspectAction(input:unknown){return saveIntakeProspect(input,createCustomerInTransaction,readCustomerProfile);}
export async function getOpenIntakeMailsAction(){const notice=await syncIntakeMailbox();const result=await readOpenIntakeMails();return result.code==='OK'?{...result,...(notice?{notice}:{})}:result;}
import {listMicrosoftGraphInbox} from '@/lib/server/microsoftGraph';
import {importOutlookMailAction} from '@/app/actions/communications.actions';
async function syncIntakeMailbox():Promise<string|null>{
 const authorization=await resolveAuthorization();
 if(!authorization.ok||!hasAuthorizationArea(authorization.data,'eingang')||!hasAuthorizationArea(authorization.data,'mails'))return null;
 try{
  const inbox=await listMicrosoftGraphInbox();
  if(inbox.code!=='OK')return inbox.message;
  for(const mail of inbox.data){
   // Graph's flag excludes inline-only images; inspect attachments independently.
   const imported=await importOutlookMailAction(mail.id);
   if(imported.code!=='OK')return imported.message;
  }
  return null;
 }catch(error){console.error('[INTAKE_MAIL_SYNC_FAILED]',error);return 'Neue Mails momentan nicht abrufbar · bereits gesicherte Eingänge bleiben verfügbar.';}
}
import { processIntakeDeviceRequest, discardIntakeCapture, chooseIntakeCaptureKind } from "@/modules/eingang/server-public";
export async function chooseIntakeCaptureKindAction(input: unknown) { return chooseIntakeCaptureKind(input); }
import { readIntakeDrafts, writeIntakeDraft, discardIntakeDraft, retryIntakeRecognition, createIntakeContinuation } from "@/modules/eingang/server-public";
import {saveGoodsReceipt,readGoodsReceipts,createGoodsReceiptStationBinding,type GoodsReceiptResult} from "@/modules/eingang/server-public";
import {parseGoodsReceiptInput} from "@/modules/eingang/public";
import {transitionWareneingangToGalvanik} from "@/lib/server/commands/orderStationCommand";
import {openIntakeOriginal,confirmIntakeOriginal} from "@/modules/eingang/server-public";
export async function openIntakeOriginalAction(input:unknown){return openIntakeOriginal(input);}
export async function confirmIntakeOriginalAction(input:unknown){return confirmIntakeOriginal(input);}

export async function getGoodsReceiptsAction(orderId:string){return readGoodsReceipts(orderId);}
export async function saveGoodsReceiptAction(input:unknown):Promise<GoodsReceiptResult>{
 if(input&&typeof input==='object'&&'quoteId'in input)return saveGoodsReceipt(input,goodsEffects);
 const parsed=parseGoodsReceiptInput(input);if(!parsed)return {code:"VALIDATION_ERROR",message:"Warenprüfung ist unvollständig oder ungültig."};
 if(parsed.command!=="galvanik")return saveGoodsReceipt(parsed,goodsEffects);
 const binding=createGoodsReceiptStationBinding(parsed,goodsEffects);
 const moved=await transitionWareneingangToGalvanik({orderId:parsed.orderId,expectedVersion:parsed.expectedOrderVersion,clientEventId:parsed.clientEventId},binding);
 if(moved.code!=="OK"){const bound=binding.result();return bound&&bound.code!=="OK"?bound:moved;}
 return binding.result()??{code:"UNAVAILABLE",message:"Warenbeleg wurde nicht sicher gelesen. Fehlercode: GOODS_RECEIPT_BINDING_MISSING."};
}

export async function getIntakeDraftsAction() { return readIntakeDrafts(); }
export async function saveIntakeDraftAction(input:unknown) { return writeIntakeDraft(input); }
export async function createIntakeContinuationAction(input:unknown) { return createIntakeContinuation(input); }
export async function discardIntakeDraftAction(input:unknown) { return discardIntakeDraft(input); }
export async function retryIntakeRecognitionAction(input:unknown) { return retryIntakeRecognition(input); }

import {
  erfasseAuftragAusEingangCommand,
  type ErfasseAuftragResult,
} from "@/modules/eingang/server-public";
import { hasAuthorizationArea, resolveAuthorization } from "@/lib/server/authorization";
import {createCustomerInTransaction,updateCustomerInTransaction, readCustomerProfile} from "@/modules/customers/server-public";
import {createOrderIntake} from "@/lib/server/commands/orderIntakeCommand";
import {presentOrderIntakeReceipt} from "@/lib/server/orderIntakeRead";
import { readCustomerOrderReadinessCommand } from "@/modules/customers/server-public";
import { saveIntakeNote, readIntakeCapture, readIntakeNoteText, readIntakePendingScope, prepareIntakeFile, finishIntakeFile, readIntakeFileChanges } from "@/modules/eingang/server-public";
import type { IntakeContext } from "@/modules/eingang/public";

export async function saveIntakeNoteAction(input: unknown) {
  return saveIntakeNote(input, readCustomerProfile);
}
export async function discardIntakeCaptureAction(input:unknown){return discardIntakeCapture(input);}
export async function prepareIntakeFileAction(input: unknown) { return prepareIntakeFile(input); }
export async function finishIntakeFileAction(fileId: string) { return finishIntakeFile(fileId); }
export async function getIntakePendingScopeAction() { return readIntakePendingScope(); }
export async function getIntakeFileChangesAction(since: string, after: string | null) { return readIntakeFileChanges(since, after); }
export async function saveIntakeDeviceRequestAction(input: unknown) {
  const session = await getAppSession();
  const fingerprint = session ? createHash("sha256").update(JSON.stringify(["intake-device", session.tenantId, session.userId, session.issuedAt])).digest("hex") : null;
  return processIntakeDeviceRequest(input, fingerprint);
}
export async function getIntakeCaptureAction(itemId: string, context?: IntakeContext, options?:{packageExpectation?:boolean}) {
  const read=await readIntakeCapture(itemId, context);
  return options?.packageExpectation===true?withPackageExpectation(read):read;
}
export async function recognizeIntakeNoteAction(text: string) {
  const authorization = await resolveAuthorization();
  if (!authorization.ok || !hasAuthorizationArea(authorization.data, "eingang")) return { code: "FORBIDDEN" as const, message: "Eingang ist nicht freigegeben." };
  if (typeof text !== "string" || text.length > 20_000) return { code: "VALIDATION_ERROR" as const, message: "Notiz darf höchstens 20.000 Zeichen enthalten." };
  return { code: "OK" as const, data: readIntakeNoteText(text) };
}

function existingCustomerId(input: unknown): string | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const customer = (input as Record<string, unknown>).customer;
  if (customer === null || typeof customer !== "object" || Array.isArray(customer)) return null;
  const value = customer as Record<string, unknown>;
  return value.mode === "EXISTING" && typeof value.customerId === "string" && value.customerId.trim().length > 0
    ? value.customerId.trim()
    : null;
}

export async function erfasseAuftragAusEingangAction(input: unknown): Promise<ErfasseAuftragResult> {
  const customerId = existingCustomerId(input);
  const authorization = await resolveAuthorization();
  if (!customerId || !authorization.ok || !hasAuthorizationArea(authorization.data, "eingang") || (input as {customer?:{changes?:unknown}})?.customer?.changes) {
    return erfasseAuftragAusEingangCommand(input,undefined,createCustomerInTransaction,updateCustomerInTransaction,after);
  }
  const customer = await readCustomerOrderReadinessCommand(authorization.data, {
    customerId,
    requirePaymentPreference: hasAuthorizationArea(authorization.data, "geld"),
  });
  if (customer.code !== "OK") {
    return customer.code === "NOT_FOUND"
      ? { code: "VALIDATION_ERROR", message: customer.message }
      : { code: "CONFLICT", message: customer.message };
  }
  const readiness = customer.readiness;
  if (readiness.issues.length > 0) {
    return {
      code: "CUSTOMER_INCOMPLETE",
      message: `Kunde ist für den Auftrag unvollständig: ${readiness.issues.map((issue) => issue.message).join(", ")}. Bitte im Abschnitt Kunde ergänzen.`,
      missing: readiness.issues.map((issue) => issue.field),
    };
  }
  return erfasseAuftragAusEingangCommand(input, { customerId, readiness },undefined,undefined,after);
}

export async function createOrderIntakeAction(input:unknown){
  const authorization=await resolveAuthorization();
  if(!authorization.ok)return {code:"UNAUTHENTICATED" as const,message:authorization.message};
  const result=await createOrderIntake(input,createCustomerInTransaction);
  return result.code==="OK"?{...result,receipt:presentOrderIntakeReceipt(result.receipt,hasAuthorizationArea(authorization.data,"geld"))}:result;
}

import {returnQuoteGoodsReceipt,readQuoteGoodsReturns} from "@/modules/eingang/server-public";
export async function recordQuoteGoodsReturnAction(input:unknown){const result=await returnQuoteGoodsReceipt(input);if(result.code==='OK'){for(const path of ['/','/warendurchlauf','/nachrichten'])revalidatePath(path);}return result;}
export async function getQuoteGoodsReturnsAction(quoteId:unknown){return readQuoteGoodsReturns(quoteId);}
