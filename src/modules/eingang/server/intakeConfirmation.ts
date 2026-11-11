import "server-only";
import { sql } from "drizzle-orm";
import {sendCommunicationMail} from "@/lib/server/communicationPort";
import { withPrivilegedTenantTransaction, type PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { OrderIntakeReceipt } from "@/lib/server/commands/orderIntakeCommand";
import { readIntakeConfirmationContext,hasIntakeConfirmationMailAttempt,readIntakeConfirmationOriginal } from "@/lib/server/intakeDraftEvents";
import {storeIntakeMailOriginal,readIntakeMailOriginal} from "@/lib/server/communicationOriginalPort";
import { orderPositionUnitLabel, orderPositionSurfaceLabel } from "@/lib/orderPositionContract";

export async function queueIntakeConfirmation(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:OrderIntakeReceipt){
  const customer=await readIntakeConfirmationContext(tx,auth,receipt.customerId,receipt.orderId);
  if(!customer.auto_info||!customer.email?.trim())return;
  await tx.execute(sql`INSERT INTO public.outbox_mails(tenant_id,objekt,vorlage,an,status)
    VALUES(${auth.tenantId},${receipt.orderId},'auftragsbestaetigung',${customer.email.trim()},'wartet')
    ON CONFLICT(tenant_id,objekt) WHERE vorlage='auftragsbestaetigung' DO NOTHING`);
}

/** Register the existing outbox sender after the response; Graph never blocks booking. */
export async function scheduleIntakeConfirmation(
  auth:AuthorizationSnapshot,
  receipt:OrderIntakeReceipt,
  afterResponse:((task:()=>Promise<void>)=>void)|undefined,
):Promise<string>{
  try{
    const rows=await withPrivilegedTenantTransaction(auth,tx=>tx.execute<{id:string;status:string;fehler_code:string|null}>(sql`
      SELECT id::text,status,fehler_code FROM public.outbox_mails
      WHERE tenant_id=${auth.tenantId} AND objekt=${receipt.orderId} AND vorlage='auftragsbestaetigung'`));
    if(!rows.length)return 'Kunde bitte informieren (keine Auto-Mail)';
    if(rows.length!==1)throw Error('INTAKE_CONFIRMATION_AMBIGUOUS');
    if(rows[0].status==='fehler'&&!await withPrivilegedTenantTransaction(auth,tx=>hasIntakeConfirmationMailAttempt(tx,auth,{orderId:receipt.orderId,outboxId:rows[0].id,sourceClientEventId:receipt.clientEventId})))return 'Auftragsbestätigung nicht gesendet · '+rows[0].fehler_code;
    if(rows[0].status==='gesendet')return 'Auftragsbestätigung wird gesendet';
    try{
      if(!afterResponse)throw Error('AFTER_RESPONSE_UNAVAILABLE');
      afterResponse(async()=>{await sendIntakeConfirmation(auth,receipt);});
    }catch(cause){
      console.error('[INTAKE_CONFIRMATION_SCHEDULE_FAILED]',{orderId:receipt.orderId,cause});
      await withPrivilegedTenantTransaction(auth,async tx=>{
        const pending=await tx.execute<{id:string}>(sql`UPDATE public.outbox_mails
          SET status='fehler',fehler_code='INTAKE_CONFIRMATION_SCHEDULE_FAILED'
          WHERE tenant_id=${auth.tenantId} AND objekt=${receipt.orderId} AND vorlage='auftragsbestaetigung' AND status='wartet'
          RETURNING id::text`);
        if(pending.length===1)await recordConfirmationOutcome(tx,auth,receipt,pending[0].id,'INTAKE_CONFIRMATION_SCHEDULE_FAILED');
      });
      return 'Auftragsbestätigung nicht gesendet · INTAKE_CONFIRMATION_SCHEDULE_FAILED';
    }
    return 'Auftragsbestätigung wird gesendet';
  }catch(cause){
    console.error('[INTAKE_CONFIRMATION_PROCESS_FAILED]',{orderId:receipt.orderId,cause});
    return 'Auftragsbestätigung ungeklärt · Code: INTAKE_CONFIRMATION_PROCESS_FAILED';
  }
}

async function recordConfirmationOutcome(tx:PrivilegedTenantTransaction,auth:AuthorizationSnapshot,receipt:OrderIntakeReceipt,id:string,failure:string|null){
  await tx.execute(sql`UPDATE public.outbox_mails SET status=${failure?'fehler':'gesendet'},fehler_code=${failure},
    gesendet_am=${failure?sql`NULL`:sql`statement_timestamp()`} WHERE tenant_id=${auth.tenantId} AND id=${id}::uuid`);
  await tx.execute(sql`INSERT INTO public.intake_event(tenant_id,item_id,art,befehl_id,von,nachher)
    SELECT ${auth.tenantId},i.id,${failure?'sendefehler':'gesendet'},${id}::uuid,${auth.userId},${JSON.stringify({orderId:receipt.orderId,vorlage:'auftragsbestaetigung',status:failure?'fehler':'gesendet',fehler_code:failure})}::jsonb
    FROM public.intake_item i WHERE i.tenant_id=${auth.tenantId} AND i.vorgang_art='auftrag' AND i.vorgang_id=${receipt.orderId}
    ORDER BY i.created_at,i.id LIMIT 1`);
}

/** Runs after booking, in a separate transaction; a failed send never undoes the order. */
export async function sendIntakeConfirmation(auth:AuthorizationSnapshot,receipt:OrderIntakeReceipt):Promise<string>{
  try{
    const prepared=await withPrivilegedTenantTransaction(auth,async tx=>{
      const rows=await tx.execute<{id:string;an:string;status:string;fehler_code:string|null}>(sql`
        SELECT id::text,an,status,fehler_code FROM public.outbox_mails
        WHERE tenant_id=${auth.tenantId} AND objekt=${receipt.orderId} AND vorlage='auftragsbestaetigung' FOR UPDATE`);
      if(!rows.length)return "Kunde bitte informieren (keine Auto-Mail)";
      if(rows.length!==1)throw Error("INTAKE_CONFIRMATION_AMBIGUOUS");
      const row=rows[0];
      if(row.status==='gesendet')return "Auftragsbestätigung wird gesendet";
      if(row.status==='fehler'&&!await hasIntakeConfirmationMailAttempt(tx,auth,{orderId:receipt.orderId,outboxId:row.id,sourceClientEventId:receipt.clientEventId}))return "Auftragsbestätigung nicht gesendet · "+row.fehler_code;
      const source={orderId:receipt.orderId,outboxId:row.id,sourceClientEventId:receipt.clientEventId};
      let original=await readIntakeConfirmationOriginal(tx,auth,source);
      const customer=original?null:await readIntakeConfirmationContext(tx,auth,receipt.customerId,receipt.orderId);
      let message:{to:string;subject:string;body:string}|null=null;
      if(original){message={to:row.an,...await readIntakeMailOriginal(original)};}
      else if(customer?.company?.trim()){
        const name=[customer.first_name,customer.last_name].filter(Boolean).join(' ');
        const greeting=customer.salutation==='frau'?`Guten Tag Frau ${customer.last_name??''}`:customer.salutation==='herr'?`Guten Tag Herr ${customer.last_name??''}`:`Guten Tag${name?' '+name:''}`;
        const date=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(receipt.dueDate+'T12:00:00Z'));
        if(receipt.termStatus==='gegenvorschlag'&&!customer.wish_date)throw Error('INTAKE_CONFIRMATION_WISH_MISSING');
        const wishDate=customer.wish_date?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin'}).format(new Date(customer.wish_date+'T12:00:00Z')):null;
        const term=receipt.termStatus==='gegenvorschlag'?`Ihr Wunschtermin ${wishDate} ist leider nicht möglich. Wir liefern am ${date}.`
          :receipt.termStatus==='bestaetigt'?date+' (bestätigt)':date+' (Ihr Wunschtermin; wir melden uns, falls er sich nicht halten lässt)';
        const address=[customer.company_name,name,[customer.street,customer.house_number].filter(Boolean).join(' '),[customer.zip_code,customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
        const handover=receipt.handoverMode==='shipping'?'Versand an '+address:`Abholung zu unseren Öffnungszeiten${customer.oeffnungszeiten?' ('+customer.oeffnungszeiten+')':''}, sobald wir Ihnen die Fertigstellung melden`;
        const payment={abholung:'Bar oder Karte bei Abholung',vorkasse:'Vorkasse',rechnung:'Rechnung auf Ziel'}[receipt.paymentMode];
        const body=[greeting,'vielen Dank für Ihren Auftrag '+receipt.orderNumber+'. Wir haben erhalten:',
          ...receipt.items.map(item=>`${item.quantity} ${item.unit?orderPositionUnitLabel(item.unit):''} ${item.name} – ${orderPositionSurfaceLabel(item.surfaceRequested)}`),
          'Liefertermin: '+term,'Übergabe: '+handover,'Zahlung: '+payment,
          ...(customer.phone?['Bei Fragen erreichen Sie uns unter '+customer.phone+'.']:[]),'Freundliche Grüße · '+customer.company].join('\n');
        message={to:row.an,subject:`Auftragsbestätigung ${receipt.orderNumber} · ${customer.company}`,body};
      }
      if(message&&!original)original=await storeIntakeMailOriginal(auth,source,message);
      // Commit the claim before contacting Graph. An unknown outcome is never retried automatically.
      await tx.execute(sql`UPDATE public.outbox_mails SET status='fehler',fehler_code='SEND_OUTCOME_UNCLEAR'
        WHERE tenant_id=${auth.tenantId} AND id=${row.id}::uuid AND status='wartet'`);
      return {id:row.id,message,original};
    });
    if(typeof prepared==='string')return prepared;
    let failure:string|null='COMPANY_NAME_MISSING';
    if(prepared.message&&prepared.original){
      const sent=await sendCommunicationMail(auth,{targetType:'ORDER',targetId:receipt.orderId,clientRequestId:prepared.id,subject:prepared.message.subject,body:prepared.message.body,intakeConfirmation:{outboxId:prepared.id,sourceClientEventId:receipt.clientEventId,original:prepared.original}});
      failure=sent.code==='OK'?null:sent.code;
    }
    if(failure)console.error('[INTAKE_CONFIRMATION_SEND_FAILED]',{orderId:receipt.orderId,code:failure});
    await withPrivilegedTenantTransaction(auth,tx=>recordConfirmationOutcome(tx,auth,receipt,prepared.id,failure));
    return failure?'Auftragsbestätigung nicht gesendet · '+failure:'Auftragsbestätigung wird gesendet';
  }catch(cause){console.error('[INTAKE_CONFIRMATION_PROCESS_FAILED]',cause);return 'Auftragsbestätigung ungeklärt · Code: INTAKE_CONFIRMATION_PROCESS_FAILED';}
}
