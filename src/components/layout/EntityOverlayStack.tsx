"use client";
import {createPortal} from "react-dom";
import {useOverlayStore} from "@/lib/overlayStore";
import {KrApp,useKrGeraet,Button,Dialog,Hinweis} from "@/ui/kr";
import dynamic from 'next/dynamic';
import type {ComponentProps} from 'react';
import {importWithRetry} from '@/lib/client/deferredDialogEvents';
import {DIALOG_LOAD_COPY,PAGE_READ_COPY,TODAY_INVOICE_COPY} from '@/ui/situationCatalog';
function EntityLoadFailure(){return <Hinweis ton="warn">{DIALOG_LOAD_COPY.unavailable}<Button text={DIALOG_LOAD_COPY.reload} onClick={()=>location.reload()}/></Hinweis>;}
const OrderCardAppAdapter=dynamic<ComponentProps<typeof import('@/app/orders/OrderCardAppAdapter').OrderCardAppAdapter>>(()=>importWithRetry(()=>import('@/app/orders/OrderCardAppAdapter')).then(module=>module.OrderCardAppAdapter,()=>EntityLoadFailure),{ssr:false,loading:()=> <p role="status">{PAGE_READ_COPY.loading}</p>});
const QuoteCardAppAdapter=dynamic<ComponentProps<typeof import('@/app/quotes/QuoteCardAppAdapter').QuoteCardAppAdapter>>(()=>importWithRetry(()=>import('@/app/quotes/QuoteCardAppAdapter')).then(module=>module.QuoteCardAppAdapter,()=>EntityLoadFailure),{ssr:false,loading:()=> <p role="status">{PAGE_READ_COPY.loading}</p>});
const CustomerCardAppAdapter=dynamic<ComponentProps<typeof import('@/app/customers/CustomerCardAppAdapter').CustomerCardAppAdapter>>(()=>importWithRetry(()=>import('@/app/customers/CustomerCardAppAdapter')).then(module=>module.CustomerCardAppAdapter,()=>EntityLoadFailure),{ssr:false,loading:()=> <p role="status">{PAGE_READ_COPY.loading}</p>});

export function EntityOverlayStack(){
 const device=useKrGeraet();
 const stack=useOverlayStore(state=>state.stack);
 const pop=useOverlayStore(state=>state.pop);
 const openOrder=useOverlayStore(state=>state.openOrder);
 const openCustomer=useOverlayStore(state=>state.openCustomer);
 const top=stack.at(-1);
 if(!top||(top.type!=="order"&&top.type!=="customer"&&top.type!=="quote"&&top.type!=="invoice")||typeof document==="undefined")return null;
 const card=top.type==="invoice"?<InvoiceOriginal invoiceId={top.id} onClose={pop}/>:top.type==="quote"?<QuoteCardAppAdapter key={top.id} quoteId={top.id} onOpenCustomer={openCustomer} onOpenOrder={openOrder} onClose={pop}/>:top.type==="order"?<OrderCardAppAdapter key={top.id} orderId={top.id} initialFocus={top.focus} onOpenCustomer={openCustomer} onClose={pop}/>:<CustomerCardAppAdapter key={top.id} customerId={top.id} takeover={top.prefill} onOpenOrder={openOrder} onClose={pop}/>;
 // One existing stack, mounted above the invoking dialog; its state stays underneath.
 return createPortal(<KrApp geraet={device} portal>{card}</KrApp>,document.body,`${top.type}:${top.id}:${stack.length}`);
}

function InvoiceOriginal({invoiceId,onClose}:{invoiceId:string;onClose:()=>void}){
 const original=`/api/invoices/${encodeURIComponent(invoiceId)}/pdf?kind=original&disposition=inline`;
 return <Dialog titel={TODAY_INVOICE_COPY.original} icon="file" groesse="breit" onSchliessen={onClose}>
  <div className="kr-stapel">
   <iframe src={original} title={TODAY_INVOICE_COPY.original} style={{width:'100%',height:'60dvh',border:0}}/>
   <a href={original} target="_blank" rel="noreferrer">{TODAY_INVOICE_COPY.openPdf}</a>
  </div>
 </Dialog>;
}
