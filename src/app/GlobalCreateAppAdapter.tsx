"use client";

import {hasQuoteFinancials} from '@/modules/eingang/public';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState,type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import {getIncomingInvoiceAction,saveIncomingInvoiceAction,changeIncomingInvoiceStatusAction,clarifyIncomingInvoiceAction,searchInvoiceSuppliersAction} from '@/app/actions/eingang.actions';
import {type InvoicePorts} from '@/modules/eingang/public';
import { logoutWithReadCleanup } from "@/lib/offline/logoutWithReadCleanup";
import {saveIntakeTaskAction,completeIntakeTaskAction,getIntakeTaskAction,createCustomerForIntakeAction,getIntakeAssignmentAction,assignIntakeCustomerAction,setIntakeNoBusinessAction} from '@/app/actions/eingang.actions';
import type {TaskPorts,AssignmentPorts} from '@/modules/eingang/public';
import { chooseIntakeCaptureKindAction } from "@/app/actions/eingang.actions";
import { createCustomerAction, getCustomersDb, readCustomerCreateReceiptAction, readCustomerAddressAction } from "@/app/actions/customers.actions";
import { erfasseAuftragAusEingangAction, getIntakeDraftsAction, saveIntakeDraftAction, discardIntakeDraftAction, createIntakeContinuationAction, getIntakePendingScopeAction, saveIntakeNoteAction, recognizeIntakeNoteAction, prepareIntakeFileAction, finishIntakeFileAction, getIntakeCaptureAction, saveIntakeDeviceRequestAction, discardIntakeCaptureAction } from "@/app/actions/eingang.actions";
import {getOrderIntakeSuggestionsAction,getGoodsReceiptsAction,saveGoodsReceiptAction,openIntakeOriginalAction,confirmIntakeOriginalAction,retryIntakeRecognitionAction} from "@/app/actions/eingang.actions";
import { readOnsiteQuoteProgressAction, receiveOnsiteQuoteAction, prepareQuoteFromIntakeAction, changeQuoteLifecycleAction, convertQuoteToOrderAction, createQuoteAction, listOpenQuotesAction, readQuoteAction, readQuoteCreateReceiptAction, readQuoteConversionReceiptAction, readQuoteUpdateReceiptAction, updateQuoteAction } from "@/app/actions/quotes.actions";
import { getOrderIntakeReceiptAction, recognizeOrderIntakeTextAction, searchOrderIntakeCustomersAction } from "@/app/warendurchlauf/actions";
import { getIntakeCatalogAction } from "@/app/actions/catalog.actions";
import {getComplaintOrderChoicesAction} from '@/app/actions/complaints.actions';

import {getOpenIntakeMailsAction,saveIntakeProspectAction} from "@/app/actions/eingang.actions";
import { getOrderRegisterDb, getLiveOrderCardAction } from "@/app/actions/orders.actions";
import {
  requestGlobalCreate,type MailSelectionPorts,type IntakeObjectPorts,
  type GlobalCreateConversionResult,
  type GlobalCreateCustomerResult,
  type GlobalCreateCustomerChoice,
  type CustomerComparisonValue,
  type GlobalCreateQuoteReadResult,
  type GlobalCreateQuoteResult,
  type GlobalCreateOpenQuotesResult,
  type GlobalCreateDirectIntakeResult,
  type DirectIntakeInput,
  type ConvertQuoteInput,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from "@/modules/eingang/public";

import { usePermissions } from "@/lib/auth/PermissionsContext";
import { canCompleteTaskArea, isAppRole } from "@/lib/auth/authorizationContract";
import { useOverlayStore } from "@/lib/overlayStore";
import {type ComplaintPorts} from '@/modules/eingang/public';
import {getComplaintDialogAction,reklamationAusfuehrenAction,nacharbeitAnlegenAction,sendeReklamationErgebnisAction,sendeNacharbeitBegleitscheinAction} from '@/app/actions/complaints.actions';
import {uploadDomainAttachment} from '@/components/attachments/DomainAttachmentPanel';
import {getDomainAttachmentOriginalAction,getDomainAttachmentsAction} from '@/app/actions/domainAttachments.actions';

import dynamic from 'next/dynamic';
import {Button,Hinweis,Toast} from '@/ui/kr';
import {DIALOG_LOAD_COPY} from '@/ui/situationCatalog';
import {createDeferredDialogEvents,withDeferredDialogReady,importWithRetry,deferredDialogUnavailable,type DeferredDialogGroup,type DeferredDialogCallbacks} from '@/lib/client/deferredDialogEvents';
const loadCreate=()=>importWithRetry(()=>import('@/modules/eingang/public')).then(module=>withDeferredDialogReady(module.GlobalCreateFlow,'create'),()=>deferredDialogUnavailable('create'));
const loadMessage=()=>importWithRetry(()=>import('@/modules/eingang/public')).then(module=>withDeferredDialogReady(module.IntakeMessageDialogs,'message'),()=>deferredDialogUnavailable('message'));
const loadObject=()=>importWithRetry(async()=>{const entry=await import('@/modules/eingang/public');const Component=await entry.IntakeObjectDialogs.load();return withDeferredDialogReady(Component,'object');}).catch(()=>deferredDialogUnavailable('object'));
const loadInvoice=()=>importWithRetry(async()=>{const entry=await import('@/modules/eingang/public');const Component=await entry.IncomingInvoiceDialogs.load();return withDeferredDialogReady(Component,'invoice');}).catch(()=>deferredDialogUnavailable('invoice'));
const loadComplaint=()=>importWithRetry(async()=>{const entry=await import('@/modules/eingang/public');const Component=await entry.ComplaintDialogs.load();return withDeferredDialogReady(Component,'complaint');}).catch(()=>deferredDialogUnavailable('complaint'));
function CommunicationUnavailable(){
 useEffect(()=>{console.warn('[DIALOG_CHUNK_LOAD_FAILED]','communication');},[]);
 return <Hinweis ton="warn">{DIALOG_LOAD_COPY.mailUnavailable}<Button text={DIALOG_LOAD_COPY.reload} onClick={()=>location.reload()}/></Hinweis>;
}
const loadCommunication=()=>importWithRetry(()=>import('@/components/communication/CommunicationPanel')).then(module=>module.CommunicationPanel,()=>CommunicationUnavailable);
const GlobalCreateFlow=dynamic<ComponentProps<typeof import('@/modules/eingang/public').GlobalCreateFlow>&DeferredDialogCallbacks>(loadCreate,{ssr:false,loading:()=>null});
const IntakeMessageDialogs=dynamic<ComponentProps<typeof import('@/modules/eingang/public').IntakeMessageDialogs>&DeferredDialogCallbacks>(loadMessage,{ssr:false,loading:()=>null});
const IntakeObjectDialogs=dynamic<ComponentProps<typeof import('@/modules/eingang/public').IntakeObjectDialogs>&DeferredDialogCallbacks>(loadObject,{ssr:false,loading:()=>null});
const IncomingInvoiceDialogs=dynamic<ComponentProps<typeof import('@/modules/eingang/public').IncomingInvoiceDialogs>&DeferredDialogCallbacks>(loadInvoice,{ssr:false,loading:()=>null});
const ComplaintDialogs=dynamic<ComponentProps<typeof import('@/modules/eingang/public').ComplaintDialogs>&DeferredDialogCallbacks>(loadComplaint,{ssr:false,loading:()=>null});
const CommunicationPanel=dynamic(loadCommunication,{ssr:false,loading:()=>null});

type ChoiceSource={contactPerson?:string|null;id:string;customerNumber?:string|null;name:string;customerType:string;companyName?:string|null;salutation?:"frau"|"herr"|"ohne"|null;firstName?:string|null;lastName?:string|null;contactRole?:string|null;email?:string|null;phone?:string|null;street?:string|null;houseNumber?:string|null;zipCode?:string|null;city?:string|null;country?:string|null;paymentPreference?:string|null;vatId?:string|null;handoverPreference?:"pickup"|"shipping"|null;autoInfo?:boolean;vorrang?:boolean;invoiceTermsEnabled?:boolean;invoiceTermDays?:number|null;duplicateMatch?:{kind:"exact"|"possible";by:string}|null};
function customerChoice(source:ChoiceSource):GlobalCreateCustomerChoice {
  if(source.customerType!=="business"&&source.customerType!=="privat"&&source.customerType!=="lieferant")throw new Error("CUSTOMER_TYPE_READMODEL_INVALID");
  return {...source,customerNumber:source.customerNumber??null,customerType:source.customerType,companyName:source.companyName??null,
    contactPerson:source.contactPerson??null,street:source.street??"",zipCode:source.zipCode??"",city:source.city??null,country:source.country??"",paymentPreference:source.paymentPreference??undefined};
}

type CreateCustomerInput = Parameters<typeof createCustomerAction>[0];

const PENDING_QUOTE_KEY = "path1.global-create.pending-quote";
const PENDING_QUOTE_CONVERSION_KEY = "path1.global-create.pending-quote-conversion";

export function GlobalCreateAppAdapter() {
  const router = useRouter();
  const mailPorts=useMemo<MailSelectionPorts>(()=>({list:getOpenIntakeMailsAction,read:getIntakeCaptureAction}),[]);
  const objectPorts=useMemo<IntakeObjectPorts>(()=>({quoteGoods:{device:saveIntakeDeviceRequestAction,read:(id,request)=>readQuoteAction({quoteId:id,purpose:'operations',...(request?.quantities?{receivedQuantities:request.quantities}:{}),...(request?.goodsReceiptId?{goodsReceiptId:request.goodsReceiptId}:{})}),capture:getIntakeCaptureAction,scope:getIntakePendingScopeAction,prepareFile:prepareIntakeFileAction,finishFile:finishIntakeFileAction,original:openIntakeOriginalAction,save:saveGoodsReceiptAction,convert:convertQuoteToOrderAction},goods:{scope:getIntakePendingScopeAction,read:getGoodsReceiptsAction,save:saveGoodsReceiptAction,prepareFile:prepareIntakeFileAction,finishFile:finishIntakeFileAction},original:{open:openIntakeOriginalAction,confirm:confirmIntakeOriginalAction,capture:getIntakeCaptureAction,retry:retryIntakeRecognitionAction}}),[]);
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const openOrder = useOverlayStore((state) => state.openOrder);
  const openQuote = useOverlayStore((state) => state.openQuote);
  const activeCustomerOverlayId = useOverlayStore((state) => {
    for (let index = state.stack.length - 1; index >= 0; index -= 1) {
      const overlay = state.stack[index];
      if (overlay?.type === "customer") return overlay.id.split("#")[0];
    }
    return null;
  });
  const { canAction, hasArea, name, role, areas,offlineScope } = usePermissions();
  const [dialogRequest,setDialogRequest]=useState<{scope:typeof offlineScope}|null>(null);
  const [dialogLoadFailed,setDialogLoadFailed]=useState(false);
  const dialogsRequested=dialogRequest!==null&&dialogRequest.scope===offlineScope;
  const deferredDialogs=useMemo(()=>createDeferredDialogEvents(()=>{if(role&&isAppRole(role))setDialogRequest({scope:offlineScope});}),[offlineScope,role]);
  const receiverReady=useCallback((group:DeferredDialogGroup)=>deferredDialogs.ready(group),[deferredDialogs]);
  const receiverFailed=useCallback((group:DeferredDialogGroup)=>{deferredDialogs.drop(group);console.warn('[DIALOG_CHUNK_LOAD_FAILED]',group);setDialogLoadFailed(true);},[deferredDialogs]);
  useLayoutEffect(()=>{
    if(!role||!isAppRole(role))return;
    return deferredDialogs.attach();
  },[deferredDialogs,role]);
  // PL22.11.13:57: the existing deferred event transport loads dialog
  // receivers on the first real open request, never during layout idle.
  const complaintPorts=useMemo<ComplaintPorts>(()=>({areas,...(canAction('createQuote')?{createQuote:(source:{id:string;number:string;customerId:string})=>requestGlobalCreate({intent:'QUOTE',prefill:{sourceComplaint:source}})}:{}),read:getComplaintDialogAction,listDeliveredOrders:getComplaintOrderChoicesAction,write:reklamationAusfuehrenAction,rework:nacharbeitAnlegenAction,sendResult:sendeReklamationErgebnisAction,sendReminder:sendeNacharbeitBegleitscheinAction,openOrder,ResultMail:input=><CommunicationPanel targetType="ORDER" targetId={input.orderId} composer={input}/>,
    addPhoto:async(orderId,file)=>({code:'OK',id:await uploadDomainAttachment('ORDER',orderId,file)}),
    openPhoto:async(photoId,_sourceItemId,orderId)=>{
      const rows=await getDomainAttachmentsAction({targetType:'ORDER',targetId:orderId});
      if(rows.code!=='OK')throw Error(rows.message);
      const original=rows.data.find(row=>row.attachmentId===photoId);if(!original)throw Error('Foto ist nicht verfügbar.');
      const result=('intakeOriginal'in original&&original.intakeOriginal)?await openIntakeOriginalAction({fileId:photoId,orderId,clientEventId:crypto.randomUUID()}):await getDomainAttachmentOriginalAction({attachmentId:photoId});
      if(result.code!=='OK')throw Error(result.message);
      const url='original'in result?result.original.downloadUrl:result.data.downloadUrl;
      if(!url)throw Error('Original ist nicht freigegeben.');
      window.open(url,'_blank','noopener,noreferrer');
    },
  }),[areas,openOrder,canAction]);

  const invoicePorts=useMemo<InvoicePorts>(()=>({read:getIncomingInvoiceAction,save:saveIncomingInvoiceAction,status:changeIncomingInvoiceStatusAction,clarify:clarifyIncomingInvoiceAction,searchSuppliers:searchInvoiceSuppliersAction,prepareFile:prepareIntakeFileAction,finishFile:finishIntakeFileAction,
    openOriginal:(itemId,fileId)=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'original',arg:itemId+'#'+fileId}})),
    openTask:taskId=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'aufgabe',arg:taskId}})),
    createSupplier:async itemId=>{const source=await getIncomingInvoiceAction({id:itemId});if(source.code!=='OK')return source;requestGlobalCreate({intent:'CUSTOMER',prefill:{sourceItemId:itemId,sourceVersion:source.view.item.version,customerMode:'lieferant',name:source.view.supplierPrefill?.name??source.view.item.sender??undefined,vatId:source.view.supplierPrefill?.vatId}});return {code:'OK'};},
  }),[]);
  const taskPorts=useMemo<TaskPorts>(()=>({read:getIntakeTaskAction,save:saveIntakeTaskAction,complete:completeIntakeTaskAction,canCompleteTaskArea:area=>isAppRole(role)&&canCompleteTaskArea({role,areas},area),referenceTargets:['kunde','auftrag'],openInvoice:id=>window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:'rechnungein',arg:id+'#klaeren'}})),openReference:reference=>{if(reference.type==='kunde'&&reference.id)openCustomer(reference.id);if(reference.type==='auftrag'&&reference.id)openOrder(reference.id);}}),[openCustomer,openOrder,areas,role]);
  const assignmentPorts=useMemo<AssignmentPorts>(()=>({read:getIntakeAssignmentAction,assign:assignIntakeCustomerAction,noBusiness:setIntakeNoBusinessAction,
    search:async query=>{const result=await searchOrderIntakeCustomersAction({query});return result.ok?{code:'OK',customers:result.data.customers.map(customer=>({id:customer.id,name:customer.name}))}:{code:'UNAVAILABLE',message:result.message};},
    openCustomer,openConversation:id=>router.push('/nachrichten?gruppe='+encodeURIComponent(id)),
    openCapture:view=>requestGlobalCreate({intent:'DIRECT_INTAKE',prefill:{sourceItemId:view.itemId,intakeKind:hasArea('preise')?'kv':'auftrag',customerId:view.customer?.id??(view.proposals.length===1?view.proposals[0].id:undefined)}}),
    openNewCustomer:(view,supplier)=>requestGlobalCreate({intent:'CUSTOMER',prefill:{sourceItemId:view.itemId,sourceVersion:view.version,name:view.senderName??undefined,email:view.senderAddress??undefined,...(supplier?{customerMode:'lieferant'}:{})}}),
  }),[openCustomer,router,hasArea]);
  const [resumeQuoteId, setResumeQuoteId] = useState<string | null>(null);
  const [resumeQuoteConversionId, setResumeQuoteConversionId] = useState<string | null>(null);
  const canCreateCustomer = canAction("createCustomer");
  const canCreateQuote = canAction("createQuote");
  const roleLabel = name.trim() || "dieses Profil";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResumeQuoteId(window.sessionStorage.getItem(PENDING_QUOTE_KEY));
      setResumeQuoteConversionId(window.sessionStorage.getItem(PENDING_QUOTE_CONVERSION_KEY));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const rememberQuote = (quoteId: string | null) => {
    if (quoteId) {
      window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
      window.sessionStorage.removeItem(PENDING_QUOTE_CONVERSION_KEY);
    } else {
      window.sessionStorage.removeItem(PENDING_QUOTE_KEY);
      window.sessionStorage.removeItem(PENDING_QUOTE_CONVERSION_KEY);
    }
    setResumeQuoteId(quoteId);
    setResumeQuoteConversionId(null);
  };

  const rememberQuoteConversion = (quoteId: string, clientEventId: string) => {
    window.sessionStorage.setItem(PENDING_QUOTE_KEY, quoteId);
    window.sessionStorage.setItem(PENDING_QUOTE_CONVERSION_KEY, clientEventId);
    setResumeQuoteId(quoteId);
    setResumeQuoteConversionId(clientEventId);
  };

  useEffect(()=>{
    const handler=(event:Event)=>{const {ziel,arg,sourceItemId}=(event as CustomEvent<{ziel:string;arg?:unknown;sourceItemId?:string}>).detail??{};
      if((ziel==='kv'||ziel==='quote')&&typeof arg==='string'){event.preventDefault();openQuote(arg);return;}
      if(ziel==='kv-vorbereiten'&&typeof sourceItemId==='string'){event.preventDefault();requestGlobalCreate({intent:'QUOTE',prefill:{sourceItemId}});return;}
      if(ziel==='nachrichten'){event.preventDefault();router.push('/nachrichten'+(typeof arg==='string'&&arg?'?gruppe='+encodeURIComponent(arg):''));return;}
      if(ziel==='eingang'&&typeof sourceItemId==='string'){event.preventDefault();requestGlobalCreate({intent:'DIRECT_INTAKE',prefill:{sourceItemId,intakeKind:hasArea('preise')?'kv':'auftrag'}});return;}
      if(ziel==="kundeneu"){requestGlobalCreate({intent:"CUSTOMER",prefill:typeof arg==="string"&&arg.endsWith("#lieferant")?{customerMode:"lieferant"}:undefined});return;}
      if (ziel === "eingang" && typeof arg === "string" && arg.endsWith("#kopie")) {
        requestGlobalCreate({ intent: "DIRECT_INTAKE", prefill: { orderCopyId: arg.slice(0, -6) } }); return;
      }
      if (ziel === "eingang" && (arg == null || typeof arg === "string" && !arg.includes("#"))) {
        requestGlobalCreate(typeof arg === "string" && arg ? { intent: "DIRECT_INTAKE", prefill: { customerId: arg } } : "DIRECT_INTAKE"); return;
      }
      if (ziel === "auftrag" && typeof arg === "string") { event.preventDefault();openOrder(arg); return; }
        if((ziel==="kunde"||ziel==="kundebearbeiten")&&typeof arg==="string")openCustomer(ziel==="kundebearbeiten"&&!arg.includes("#")?arg+"#bearbeiten":arg);
    };
    window.addEventListener("kreile:oeffne",handler);return()=>window.removeEventListener("kreile:oeffne",handler);
  },[openCustomer,openOrder,openQuote,router,hasArea]);

  // Keep one safe, typed intake boundary mounted for authenticated workshop roles.
  // Their request is denied by the same flow before any command can run.
  if (!role || !isAppRole(role)) return null;

  return (
    <>{dialogLoadFailed?<Toast text={DIALOG_LOAD_COPY.unavailable} aktion={{text:DIALOG_LOAD_COPY.reload,onClick:()=>location.reload()}}/>:null}{dialogsRequested?<><ComplaintDialogs onReceiverReady={receiverReady} onReceiverFailed={receiverFailed} ports={complaintPorts} onRefresh={()=>router.refresh()}/><IncomingInvoiceDialogs onReceiverReady={receiverReady} onReceiverFailed={receiverFailed} ports={invoicePorts} allowed={hasArea('buchhaltung')} onRefresh={()=>router.refresh()}/><IntakeMessageDialogs onReceiverReady={receiverReady} onReceiverFailed={receiverFailed} ports={mailPorts} taskPorts={taskPorts} assignmentPorts={assignmentPorts} onRefresh={()=>router.refresh()}/><IntakeObjectDialogs onReceiverReady={receiverReady} onReceiverFailed={receiverFailed} ports={objectPorts} onOpenCustomer={openCustomer} onOpenOrder={openOrder} onOpenQuote={openQuote} customerOverlayId={activeCustomerOverlayId} allowed={hasArea("eingang")} originalAllowed={hasArea('eingang')||hasArea('buchhaltung')} onRefresh={()=>router.refresh()}/><GlobalCreateFlow onReceiverReady={receiverReady} onReceiverFailed={receiverFailed}
      key={offlineScope??'no-offline-actor'} ports={{
        offlineScope,
        readIntakeOrderSource: async (orderId) => {
          const result = await getLiveOrderCardAction({ orderId });
          if (result.code !== "OK") return result;
          return { code: "OK", source: { orderNumber: result.data.card.orderNumber, customerId: result.data.card.customerId,
            customerQuery: result.data.card.customerNumber ?? result.data.card.customerName,
            intakeSource: result.data.card.intakeSource, items: result.data.card.items } };
        },
        saveProspect:saveIntakeProspectAction,
        drafts: { readDrafts: getIntakeDraftsAction, saveDraft: saveIntakeDraftAction, discardDraft: discardIntakeDraftAction },
        createContinuation: createIntakeContinuationAction,
        canCreateCustomer,
        canReadCustomers:hasArea("kunden"),
        canReadMails: hasArea("mails"),
        getCaptureScope: getIntakePendingScopeAction,
        getCapture: getIntakeCaptureAction,
        discardCapture: discardIntakeCaptureAction,
        deviceRequest: saveIntakeDeviceRequestAction,
        saveCaptureNote: saveIntakeNoteAction,
        readCaptureOriginal: openIntakeOriginalAction,
        readCaptureNote: recognizeIntakeNoteAction,
        prepareCaptureFile: prepareIntakeFileAction,
        finishCaptureFile: finishIntakeFileAction,
        chooseCaptureKind: chooseIntakeCaptureKindAction,
        openCaptureObject: (ziel, arg) => !window.dispatchEvent(new CustomEvent("kreile:oeffne", { detail: { ziel, arg }, cancelable: true })),
        canCreateOrder: hasArea("eingang"),
        canCreateQuote,
        canManageMoney: hasArea("zahlungen"),
        canManageSupplierBank: hasArea("buchhaltung"),
        canManagePrices: hasArea("preise"),
        canDecide:hasArea("entscheiden"),
        showPrimaryTrigger: false,
        roleLabel,
        actorDisplayName:name,
        resumeQuoteId,
        resumeQuoteConversionId,
        listCustomers: async () => {
          const result = await getCustomersDb();
          if (!result.ok) {
            return {
              code: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN" ? "DENIED" as const : "UNAVAILABLE" as const,
              message: result.error === "UNAUTHORIZED" || result.error === "FORBIDDEN"
                ? "Der Kundenstamm ist für dieses Profil nicht freigegeben."
                : "Der Kundenstamm konnte nicht sicher gelesen werden.",
            };
          }
          return {
            code: "OK" as const,
            customers: result.data.map(customer=>customerChoice({...customer,customerType:customer.type})),

          };
        },
        searchIntakeCustomers: async (query,candidate?:CustomerComparisonValue) => {
          const result = await searchOrderIntakeCustomersAction(candidate?{query,candidate}:{query});
          if (!result.ok) {
            return {
              code: result.error === "FORBIDDEN" || result.error === "AUTH_ERROR" ? "DENIED" as const : "UNAVAILABLE" as const,
              message: result.message,
            };
          }
          return {
            code: "OK" as const,
            customers: result.data.customers.map(customerChoice),

          };
        },
        recognizeIntakeText: async (text) => {
          const result = await recognizeOrderIntakeTextAction({ text });
          if (result.ok) return { code: "OK" as const, data: result.data };
          return {
            code: result.error === "FORBIDDEN" ? "FORBIDDEN" as const : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const,
            message: result.message,
          };
        },
        getIntakeSuggestions: async (input) => {
          const result = await getOrderIntakeSuggestionsAction(input);
          if (result.ok) return { code: "OK" as const, data: result.data };
          return {
            code: result.error === "FORBIDDEN" ? "FORBIDDEN" as const : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" as const : "UNAVAILABLE" as const,
            message: result.message,
          };
        },
        listCatalog: async () => {
          const result = await getIntakeCatalogAction();
          return result.code === "OK" ? result : { code: result.code === "FORBIDDEN" ? "DENIED" as const : "UNAVAILABLE" as const, message: result.message };
        },
        checkCustomerAddress: readCustomerAddressAction,
        createCustomer: async (input: CreateCustomerInput): Promise<GlobalCreateCustomerResult> => {
          const result = await createCustomerAction(input);
          if (result.code !== "OK") return result;
          return {
            code: "OK",
            replayed: result.replayed,
            receipt: result.receipt,
            customer: customerChoice(result.customer),
          };
        },
        createCustomerFromCapture:async(input,source)=>{
          const result=await createCustomerForIntakeAction({customer:input,...source});
          if(result.code!=='OK')return result;
          return {code:'OK',replayed:result.replayed,receipt:result.receipt,customer:customerChoice(result.customer)};
        },
        readCustomerCreateReceipt: async (input: CreateCustomerInput): Promise<GlobalCreateCustomerResult> => {
          const result = await readCustomerCreateReceiptAction(input);
          if (result.code !== "OK") return result;
          return {code:"OK",replayed:true,receipt:result.receipt,customer:customerChoice(result.customer)};
        },
        prepareQuote:prepareQuoteFromIntakeAction,
        receiveOnsiteQuote: receiveOnsiteQuoteAction,
        readOnsiteQuoteProgress: readOnsiteQuoteProgressAction,
        createQuote: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => createQuoteAction(input),
        updateQuote: async (input: UpdateQuoteInput): Promise<GlobalCreateQuoteResult> => updateQuoteAction(input),
        readQuoteCreateReceipt: async (input: CreateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteCreateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        readQuote: async (input: { quoteId: string }): Promise<GlobalCreateQuoteReadResult> => {const result=await readQuoteAction(input);return result.code!=='OK'?result:hasQuoteFinancials(result.quote)?{...result,quote:result.quote}:{code:'FORBIDDEN',message:'KV-Finanzansicht ist nicht freigegeben.'};},
        assignCaptureCustomer: assignIntakeCustomerAction,
        listOpenQuotes: async (): Promise<GlobalCreateOpenQuotesResult> => listOpenQuotesAction(),
        readQuoteUpdateReceipt: async (input: UpdateQuoteInput): Promise<GlobalCreateQuoteResult> => {
          const result = await readQuoteUpdateReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        recordQuoteAcceptance:async input=>{const result=await changeQuoteLifecycleAction(input);return result.code!=='OK'?result:hasQuoteFinancials(result.quote)?{...result,quote:result.quote}:{code:'FORBIDDEN',message:'KV-Finanzansicht ist nicht freigegeben.'};},
        convertQuote: async (input: ConvertQuoteInput): Promise<GlobalCreateConversionResult> => {const result=await convertQuoteToOrderAction(input);return result.code!=='OK'?result:hasQuoteFinancials(result.quote)?{...result,quote:result.quote}:{code:'FORBIDDEN',message:'KV-Finanzansicht ist nicht freigegeben.'};},
        readQuoteConversionReceipt: async (input: { quoteId: string; clientEventId: string }): Promise<GlobalCreateConversionResult> => {
          const result = await readQuoteConversionReceiptAction(input);
          return result.code === "OK" ? { ...result, replayed: true } : result;
        },
        createDirectIntake: async (input: DirectIntakeInput): Promise<GlobalCreateDirectIntakeResult> => {
          const result = await erfasseAuftragAusEingangAction({
            geprueft: input.geprueft,
            ...(input.wishDate!==undefined?{wishDate:input.wishDate}:{}),...(input.termOrigin!==undefined?{termOrigin:input.termOrigin}:{}),...(input.processingWeeks!==undefined?{processingWeeks:input.processingWeeks}:{}),
            ...(input.draftId ? {draftId:input.draftId} : {}),
            ...(input.sourceCaptures?{sourceCaptures:input.sourceCaptures}:{}),
            clientKey: input.clientEventId,
            text: null,
            telefonNotiz: input.intakeSource === "anfrage_telefon" ? input.note : null,
            customer: input.customer,
            dueDate: input.dueDate,
            items: input.items,
            intakeSource: input.intakeSource,
            termStatus: input.termStatus,
            handoverMode: input.handoverMode,
            paymentMode: input.paymentMode,
          });
          if (result.code !== "OK") return result;
          const readback = await getOrderIntakeReceiptAction({ orderId: result.orderId, clientEventId: input.clientEventId });
          if (!readback.ok) {
            return {
              code: readback.error === "FORBIDDEN" ? "FORBIDDEN" : readback.error === "AUTH_ERROR" ? "UNAUTHENTICATED" : "UNAVAILABLE",
              message: readback.message,
            };
          }
          if (!readback.data) return { code: "UNAVAILABLE", message: "Der gespeicherte Eingang konnte nicht sicher gelesen werden." };
          return { code: "OK", replayed: result.replayed, receipt: readback.data, confirmationMessage: result.confirmationMessage };
        },
        readDirectIntakeReceipt: async ({ orderId, clientEventId }): Promise<GlobalCreateDirectIntakeResult> => {
          const result = await getOrderIntakeReceiptAction({ orderId, clientEventId });
          if (!result.ok) {
            return {
              code: result.error === "FORBIDDEN" ? "FORBIDDEN" : result.error === "AUTH_ERROR" ? "UNAUTHENTICATED" : "UNAVAILABLE",
              message: result.message,
            };
          }
          if (!result.data) return { code: "NOT_FOUND", message: "Der gespeicherte Eingang wurde nicht gefunden." };
          return { code: "OK", replayed: true, receipt: result.data };
        },
        rememberQuote,
        rememberQuoteConversion,
        activeCustomerOverlayId,
        getCreateContext: async () => {
          const overlay = [...useOverlayStore.getState().stack].reverse().find(entry => entry.type === "customer" || entry.type === "order");
          if (!overlay || (overlay.type !== "customer" && overlay.type !== "order")) return { code: "OK", context: null };
          if (overlay.type === "order") {
            const result = await getOrderRegisterDb({ filter: "ORDER" });
            if (!result.ok) return { code: "UNAVAILABLE", message: result.message };
            const order = result.data.find(entry => entry.id === overlay.id.split("#")[0]);
            return order ? { code: "OK", context: { customerId: order.customerId, label: `${order.reference} · ${order.customerName}` } }
              : { code: "NOT_FOUND", message: "Auftrag des geöffneten Kontexts wurde nicht gefunden." };
          }
          const result = await getCustomersDb();
          if (!result.ok) return { code: "UNAVAILABLE", message: "Kundenkontext konnte nicht sicher gelesen werden." };
          const customer = result.data.find(entry => entry.id === overlay.id.split("#")[0]);
          return customer ? { code: "OK", context: { customerId: customer.id, label: customer.name } }
            : { code: "NOT_FOUND", message: "Kunde des geöffneten Kontexts wurde nicht gefunden." };
        },
        openCustomer,
        openOrder,
        refresh: () => router.refresh(),
        switchProfile: async () => {
          try{await logoutWithReadCleanup();}
          finally{router.replace("/start");router.refresh();}
        },
      }}
    /></>:null}</>
  );
}
