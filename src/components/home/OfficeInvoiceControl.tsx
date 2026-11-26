'use client';
import {useState} from 'react';
import type {TodayDashboard,TodayInvoiceSheetRow} from '@/lib/server/todayDashboard';
import {formatEuro} from '@/lib/domain/formatEuro';
import {useOverlayStore} from '@/lib/overlayStore';
import {Button,Dialog,Hinweis,Icon,Zustand} from '@/ui/kr';
import {PAGE_READ_COPY,TODAY_INVOICE_COPY,V45_TEXT} from '@/ui/situationCatalog';
import styles from './OfficeInvoiceControl.module.css';

const percent=new Intl.NumberFormat('de-DE',{style:'percent',maximumFractionDigits:1});
const day=new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
type Props={
 sheet:NonNullable<TodayDashboard['invoiceSheet']>;
 money:NonNullable<TodayDashboard['invoiceMoney']>;
 today:string;
 onReload:()=>void;
 onOpenInvoice:(invoiceId:string)=>void;
};

function invoiceDue(row:TodayInvoiceSheetRow,today:string){
 if(row.overdue===null)return PAGE_READ_COPY.qualificationUnknown;
 const date=new Date(row.dueDate+'T00:00:00Z');
 if(!row.overdue)return TODAY_INVOICE_COPY.due(day.format(date));
 const days=(Date.parse(today+'T00:00:00Z')-date.getTime())/86_400_000;
 return TODAY_INVOICE_COPY.daysOverdue(days);
}

export function OfficeInvoiceControl({sheet,money,today,onReload,onOpenInvoice}:Props){
 const [opener,setOpener]=useState<HTMLButtonElement|null>(null);
 const openCustomer=useOverlayStore(state=>state.openCustomer);
 const openOrder=useOverlayStore(state=>state.openOrder);
 const knownTotal=money.code==='OK';
 const incomplete=!knownTotal||sheet.incomplete;
 return <>
  <button type="button" className={styles.tile} aria-label={TODAY_INVOICE_COPY.title} onClick={event=>setOpener(event.currentTarget)}>
   <span className={styles.tileTitle}>{TODAY_INVOICE_COPY.title}<Icon name="file"/></span>
   {knownTotal?<><strong>{formatEuro(money.openCents)}</strong><span>{TODAY_INVOICE_COPY.openInvoices(money.openCount)}</span>
    {money.overdueCount>0&&<span className={styles.tileOverdue}>{formatEuro(money.overdueCents)} · {TODAY_INVOICE_COPY.overdueInvoices(money.overdueCount)}</span>}</>:
    <span>{PAGE_READ_COPY.qualificationUnknown}</span>}
  </button>
  {opener&&<Dialog titel={TODAY_INVOICE_COPY.title} unterzeile={knownTotal?TODAY_INVOICE_COPY.count(money.openCount):undefined}
    icon="euro" groesse="breit" dataSpecId="rechnungen" oeffner={opener} onSchliessen={()=>setOpener(null)}>
   <div className={styles.sheet}>
    {incomplete&&<Hinweis ton="warn">{PAGE_READ_COPY.sourceIncomplete}<Button art="leise" text={PAGE_READ_COPY.reload} onClick={onReload}/></Hinweis>}
    {knownTotal&&money.openCount===0&&<Zustand art="leer" text={V45_TEXT.out$no_payments}/>}
    {knownTotal&&money.openCount>0&&<section className={styles.totals} aria-label={TODAY_INVOICE_COPY.receivables}>
     <div>{TODAY_INVOICE_COPY.openTotal}<strong>{formatEuro(money.openCents)}</strong></div>
     <div>{TODAY_INVOICE_COPY.overdueTotal}<strong>{formatEuro(money.overdueCents)}</strong></div>
     <div className={styles.ratio}><progress max={money.openCents} value={money.overdueCents} aria-label={TODAY_INVOICE_COPY.overdueTotal}/>
      <span><strong>{percent.format(money.overdueCents/money.openCents)}</strong> {TODAY_INVOICE_COPY.overdue}</span></div>
    </section>}
    {sheet.rows.length>0&&<ul className={styles.rows}>{sheet.rows.map(row=>{
     const amount=formatEuro(row.amountCents),due=invoiceDue(row,today);
     const {customerId,order}=row;
     const line=<><strong>{row.customerName} · {amount}</strong><span>{due} · {row.number}</span></>;
     return <li key={row.id} className={styles.row} data-overdue={row.overdue===true}>
      {row.openOriginal?<button type="button" className={styles.entry} onClick={()=>onOpenInvoice(row.id)}
        aria-label={TODAY_INVOICE_COPY.open(row.number,row.customerName,amount,due)}>{line}</button>:
        <div className={styles.entry}>{line}</div>}
      {(customerId||order)&&<details>
       <summary>{TODAY_INVOICE_COPY.other}</summary>
       <div className="kr-schnellleiste">
        {customerId&&<Button art="leise" text={TODAY_INVOICE_COPY.customer(row.customerName)} onClick={()=>openCustomer(customerId)}/>}
        {order&&<Button art="leise" text={TODAY_INVOICE_COPY.order(order.number)} onClick={()=>openOrder(order.id)}/>}
       </div>
      </details>}
     </li>;
    })}</ul>}
   </div>
  </Dialog>}
 </>;
}
