// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {beforeAll,expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {enableOutlookTestFixture,createFixture,full,nativeFetch,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture,invoiceCompanySettingsFixture} from '../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {readCustomerProfile} from '@/modules/customers/server-public';
import {pruefeZusage,type ZusageLeser} from '@/modules/eingang/server-public';
import {emptyDispatchPolicy} from '@/modules/fundament/public';
import {readShippingSettingsInTransaction} from '@/modules/fundament/server-public';
import {MAIL_PROMISE_COPY} from '@/ui/eingangMailCopy';

beforeAll(enableOutlookTestFixture);

it('reads the carrier handoff, booked label and cutoff for a confirmed mail and leaves unrelated mail without a proposal',async()=>{
  const customerId=await customerFixture('TEST S-1 Versandgrenze');
  const {receipt:{orderId}}=await intakeOrderFixture('TEST S-1 Paket',customerId,'shipping');
  const {receipt:{orderId:pickupId}}=await intakeOrderFixture('TEST S-1 zur Abholung',customerId,'pickup');
  const address='test-c8-'+randomUUID()+'@example.invalid';
  await sql`UPDATE public.customers SET email=${address} WHERE tenant_id=${tenant} AND id=${customerId}`;
  await invoiceCompanySettingsFixture();
  const graphMail=(subject:string,body:string)=>({
    id:'TEST-C8-'+randomUUID(),internetMessageId:`<${randomUUID()}@example.invalid>`,subject,
    from:{emailAddress:{name:'TEST Kontakt',address}},receivedDateTime:new Date().toISOString(),bodyPreview:body,
    body:{contentType:'text',content:body},hasAttachments:false,
  });
  const request=graphMail('TEST S-1 Abholung','Ich hole die Ware selbst ab.');
  const unrelated=graphMail('TEST S-1 Gruß','Alles Gute zum Geburtstag.');
  const shippingRequest=graphMail('TEST S-1 Versandwunsch','Bitte senden Sie mir die Ware stattdessen zu.');
  // Only Outlook is doubled. The import saves the complete MIME original in local storage.
  vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-C8-provider-token'.repeat(3)});
    if(url.hostname!=='graph.microsoft.com')return nativeFetch(input,init);
    if(url.pathname.includes('/mailFolders/inbox/messages'))return Response.json({value:[request,unrelated,shippingRequest]});
    const mail=[request,unrelated,shippingRequest].find(entry=>url.pathname.split('/').includes(entry.id));
    if(!mail)throw Error('TEST_C8_PROVIDER_ORIGINAL_MISSING');
    if(url.pathname.endsWith('/$value'))return new Response(`From: ${address}\r\nMessage-ID: ${mail.internetMessageId}\r\nSubject: ${mail.subject}\r\n\r\n${mail.body.content}`);
    if(url.pathname.endsWith('/attachments'))return Response.json({value:[]});
    return Response.json(mail);
  });
  const {getOpenIntakeMailsAction}=await import('@/app/actions/eingang.actions');
  expect(await withSession(full,()=>getOpenIntakeMailsAction())).toMatchObject({code:'OK'});
  const originals=await sql`SELECT item.id::text,item.version,item.graph_message_id FROM public.intake_item item
    JOIN public.intake_file file ON file.tenant_id=item.tenant_id AND file.item_id=item.id AND file.mime='message/rfc822'
    WHERE item.tenant_id=${tenant} AND item.graph_message_id IN (${request.id},${unrelated.id},${shippingRequest.id})`;
  const original=originals.find(item=>item.graph_message_id===request.id);
  const other=originals.find(item=>item.graph_message_id===unrelated.id);
  const reverse=originals.find(item=>item.graph_message_id===shippingRequest.id);
  if(!original||!other||!reverse)throw Error('TEST_C8_ORIGINAL_REQUIRED');
  await sql`UPDATE public.intake_item SET kunde_id=${customerId},zuordnung='hand',vorgang_art='auftrag',vorgang_id=${orderId}
    WHERE tenant_id=${tenant} AND id=${original.id}::uuid`;
  await sql`UPDATE public.intake_item SET kunde_id=${customerId},zuordnung='hand',vorgang_art='auftrag',vorgang_id=${pickupId}
    WHERE tenant_id=${tenant} AND id=${reverse.id}::uuid`;
  const authorization=await withSession(full,()=>resolveAuthorization());
  if(!authorization.ok)throw Error('TEST_C8_AUTH_REQUIRED');
  const unused=async()=>{throw Error('TEST_C8_UNRELATED_READER');};
  const readers:ZusageLeser={termin:unused,kv:unused,verbrauch:unused,versandEinstellungen:readShippingSettingsInTransaction,
    kunde:(auth,id)=>withPrivilegedTenantTransaction(auth,tx=>readCustomerProfile(tx,auth.tenantId,id))};
  const read=(input:Parameters<typeof pruefeZusage>[1])=>pruefeZusage(authorization.data,input,readers);
  const plan={art:'zu_spaet' as const,customerId,orderId,sourceItemId:original.id,sourceVersion:original.version,
    anliegen:'A9',wirkung:'versand_stoppen'};
  const reminder={...plan,anliegen:'A21',wirkung:'wiedervorlage_vor_annahmeschluss'};
  const pickupChange={...plan,orderId:pickupId,sourceItemId:reverse.id,sourceVersion:reverse.version,
    anliegen:'A9b',wirkung:'uebergabeart_aendern'};
  expect(await read(pickupChange)).toEqual({frei:true});
  expect(await read({...pickupChange,anliegen:'A9',wirkung:'versand_stoppen'}))
    .toEqual({frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.zu_spaet});
  const paymentNotice={...plan,anliegen:'A14',wirkung:'zahlungsavis_vormerken',art:'zahlungsavis' as const};
  const paymentAsChannel={...paymentNotice,art:'kanal_versand' as const,kanal:'mail'};
  const operator=await createFixture(['mails','auftraege'],'werkstatt');
  const restricted=await withSession(operator,()=>resolveAuthorization());
  if(!restricted.ok)throw Error('TEST_C8_RESTRICTED_LOGIN_REQUIRED');
  expect(await pruefeZusage(restricted.data,paymentAsChannel,readers)).toMatchObject({frei:false,grund:'recht'});
  expect(await pruefeZusage(restricted.data,paymentNotice,readers)).toMatchObject({frei:false,grund:'recht'});
  expect(await read(paymentAsChannel)).toEqual({frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable});
  expect(await read(paymentNotice)).toEqual({frei:false,grund:'zahlungsavis',text:MAIL_PROMISE_COPY.paymentNotice});
  expect(await read({...plan,sourceItemId:other.id,sourceVersion:other.version,anliegen:'A12',wirkung:'reklamation_aufnehmen'}))
    .toEqual({frei:false,grund:'kein_vorschlag',text:MAIL_PROMISE_COPY.noProposal});
  const carrier='TEST C8 Paketdienst';
  const setCutoff=(time:string)=>sql`UPDATE public.company_settings SET ausgang_regeln=${sql.json({
    ...emptyDispatchPolicy(),carrierCutoffs:[{service:carrier,day:5,time}],
  })}::jsonb WHERE tenant_id=${tenant}`;
  const shipmentId=randomUUID();
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date('2026-11-27T11:00:00Z'));
  try{
    await setCutoff('12:01');
    expect(await read(plan)).toEqual({frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.pending.zu_spaet});
    await sql`INSERT INTO public.shipments(id,tenant_id,order_id,carrier,status)
      VALUES(${shipmentId}::uuid,${tenant},${orderId},${carrier},'created')`;
    expect(await read(plan)).toEqual({frei:true});
    expect(await read({...plan,art:'kanal_versand',kanal:'mail'})).toEqual({frei:false,grund:'unbekannt',text:MAIL_PROMISE_COPY.unavailable});
    expect(await read(reminder)).toEqual({frei:true});
    await sql`UPDATE public.shipments SET label_url='https://example.invalid/TEST-Etikett' WHERE tenant_id=${tenant} AND id=${shipmentId}::uuid`;
    expect(await read({...plan,art:'etikett'})).toEqual({frei:false,grund:'etikett',text:MAIL_PROMISE_COPY.labelBooked});
    expect(await read(reminder)).toEqual({frei:true});
    await setCutoff('12:00');
    const tooLate={frei:false,grund:'zu_spaet',text:MAIL_PROMISE_COPY.tooLate};
    expect(await read(plan)).toEqual(tooLate);
    expect(await read(reminder)).toEqual(tooLate);
    expect(await read(pickupChange)).toEqual({frei:true});
    await setCutoff('12:01');
    await sql`UPDATE public.shipments SET status='shipped',shipped_at=statement_timestamp() WHERE tenant_id=${tenant} AND id=${shipmentId}::uuid`;
    expect(await read(plan)).toEqual(tooLate);
    expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${tenant} AND id=${pickupId}`)
      .toEqual([{handover_mode:'pickup'}]);
    expect(await sql`SELECT handover_mode FROM public.orders WHERE tenant_id=${tenant} AND id=${orderId}`)
      .toEqual([{handover_mode:'shipping'}]);
  }finally{
    vi.useRealTimers();
  }
});
