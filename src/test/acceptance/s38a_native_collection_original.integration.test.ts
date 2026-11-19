// @vitest-environment node
// Explicit SYNTHETIC initial historical TEST records: no claim that today's
// physical action happened last month. Issuance/Auth/DB/PDF/XML/retry are real.
// No clock override, trigger bypass, updated immutable evidence or remote data.
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {expect,it,vi} from 'vitest';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {issueCollectionInvoiceAction,getInvoiceReceiptAction} from '@/app/actions/invoices.actions';
import {readInvoicePdf} from '@/lib/server/invoiceRead';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {sql as statement} from 'drizzle-orm';
import {confirmPaymentAction} from '@/app/actions/payments.actions';
import {readPaymentSummary} from '@/lib/server/paymentSummaryRead';

async function historicalCollection(rates:readonly number[]){
 if(!tenant.startsWith('TEST-ablauf-')||rates.length!==3)throw Error('TEST_HISTORICAL_SOURCE_REQUIRED');
 const [clock]=await sql`SELECT to_char(date_trunc('month',statement_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '1 month','YYYY-MM-DD') AS month`;
 const month=String(clock.month),frozenAt=month.slice(0,8)+'10T12:00:00.000Z',handoverAt=month.slice(0,8)+'12T12:00:00.000Z',start=month+'T08:00:00.000Z';
 const customerId=randomUUID(),historicalActor=randomUUID(),rateId=randomUUID(),agreementId=randomUUID(),collectionId=randomUUID();
 const members:Array<{orderId:string;number:string;freezeId:string}> = [];
 try{await sql.begin(async tx=>{
  await tx`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active,created_at,updated_at)
   VALUES(${historicalActor}::uuid,${tenant},${'TEST-old-'+historicalActor+'@example.invalid'},'TEST Historical Source','meister',false,${start}::timestamptz,${start}::timestamptz)`;
  await tx`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,ziel_freigeschaltet,ziel_tage,source,first_name,last_name,salutation,created_at,updated_at)
   VALUES(${customerId},${tenant},${'TEST-'+customerId},'TEST Collection Customer','TEST Collection Customer GmbH','business','TEST Person',${'TEST-'+customerId+'@example.invalid'},'+49 711 5550189','TEST Weg','1','70176','Stuttgart','DE','rechnung',true,14,'manual','TEST','Person','ohne',${start}::timestamptz,${start}::timestamptz)`;
  await tx`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days,versand_pauschale_netto_cents)
   SELECT ${randomUUID()},${tenant},'TEST Collection Seller','TEST Seller 1','70176','Stuttgart','DE','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14,1000 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${tenant})`;
  await tx`INSERT INTO private.extra_work_hourly_rates(id,tenant_id,hourly_rate_cents,version,created_by,effective_at)
   SELECT ${rateId}::uuid,${tenant},14000,1,${historicalActor}::uuid,${start}::timestamptz WHERE NOT EXISTS(SELECT 1 FROM private.extra_work_hourly_rates WHERE tenant_id=${tenant})`;
  const [existingRate]=await tx`SELECT id::text FROM private.extra_work_hourly_rates WHERE tenant_id=${tenant} ORDER BY version DESC LIMIT 1`;
  await tx`INSERT INTO public.customer_agreements(id,tenant_id,customer_id,position,bezeichnung,typ,ziel_tage,geld,hinweis,grund,version,client_key,created_at,created_by)
   VALUES(${agreementId}::uuid,${tenant},${customerId},1,'TEST Monthly Collection','sammelrechnung',30,true,false,'TEST agreed monthly invoice',1,${randomUUID()}::uuid,${start}::timestamptz,${historicalActor}::uuid)`;
  await tx`INSERT INTO public.invoice_collections(id,tenant_id,customer_id,monat,ziel_tage,status,version,created_at,created_by)
   VALUES(${collectionId}::uuid,${tenant},${customerId},${month}::date,30,'offen',1,${start}::timestamptz,${historicalActor}::uuid)`;
  for(let i=0;i<3;i++){
   const orderId=randomUUID(),freezeId=randomUUID(),freezeEvent=randomUUID(),number='TEST-COL-'+randomUUID().slice(0,8);
   await tx`INSERT INTO public.orders(id,tenant_id,order_number,customer_id,title,station,current_station,current_station_id,status,version,payment_mode,payment_mode_version,handover_mode,source,created_at,due_date,geprueft)
    VALUES(${orderId},${tenant},${number},${customerId},${'TEST Historical Member '+i},'abgeholt','abgeholt','abgeholt','abgeholt',3,'rechnung',0,'pickup','F1_ORDER_INTAKE',${start}::timestamptz,${frozenAt}::timestamptz,true)`;
   await tx`INSERT INTO public.items(id,tenant_id,order_id,customer_id,name,quantity,current_station_id,preis_netto,unit,vat_rate_basis_points,material,surface_requested,created_at)
    VALUES(${randomUUID()},${tenant},${orderId},${customerId},${'TEST Collection Part '+i},1,'abgeholt',${i===2?'33.34':'33.33'}::numeric,'Stück',${rates[i]},'Messing','Verchromen',${start}::timestamptz)`;
   const payload={freezeId,rateId:existingRate.id,hourlyRateCents:14000,totalAmountCents:0,lineCount:0};
   await tx`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,created_at,payload,status,station,from_station,client_event_id,event_schema_version,correlation_id,aggregate_version)
    VALUES(${freezeEvent},${tenant},${orderId},'ORDER_FROZEN_V1','TEST SYNTHETIC initial historical freeze',${historicalActor}::uuid,${frozenAt}::timestamptz AT TIME ZONE 'UTC',${tx.json(payload)}::jsonb,'success','fertig','galvanik',${randomUUID()}::uuid,1,${randomUUID()}::uuid,2)`;
   await tx`INSERT INTO private.order_freezes(id,tenant_id,order_id,event_id,hourly_rate_id,hourly_rate_cents,total_amount_cents,line_count,order_version,frozen_by,frozen_at)
    VALUES(${freezeId}::uuid,${tenant},${orderId},${freezeEvent},${existingRate.id}::uuid,14000,0,0,2,${historicalActor}::uuid,${frozenAt}::timestamptz)`;
   await tx`INSERT INTO public.invoice_collection_orders(collection_id,tenant_id,order_id,created_at) VALUES(${collectionId}::uuid,${tenant},${orderId},${handoverAt}::timestamptz)`;
   const out={orderId,orderVersion:3,paymentMode:'rechnung',mode:'abholung',gateAllowed:true,settlement:'collection',agreementId,agreementType:'sammelrechnung',agreementVersion:1};
   await tx`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,user_id,created_at,payload,status,station,from_station,client_event_id,event_schema_version,correlation_id,aggregate_version)
    VALUES(${randomUUID()},${tenant},${orderId},'ORDER_PICKED_UP_V3','TEST SYNTHETIC initial historical handover',${historicalActor}::uuid,${handoverAt}::timestamptz AT TIME ZONE 'UTC',${tx.json(out)}::jsonb,'success','abgeholt','fertig',${randomUUID()}::uuid,3,${randomUUID()}::uuid,3)`;
   members.push({orderId,number,freezeId});
  }
 });}catch(error){console.error('[TEST_HISTORICAL_SOURCE_CONSTRAINT]',(error as {detail?:string}).detail);throw error;}
 return {collectionId,customerId,month,members};
}

async function inspectOriginal(bytes:Uint8Array,members:Array<{number:string}>,label:string,invoiceId:string){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:bytes.slice(),verbosity:0});
 try{
  const document=await task.promise,attachments=await document.getAttachments();
  expect(attachments?.size).toBe(1);if(!attachments)throw Error('TEST_COLLECTION_EMBEDDED_ORIGINAL_REQUIRED');
  const [id,attachment]=[...attachments][0];expect(attachment.filename).toBe('factur-x.xml');
  const xml=await document.getAttachmentContent(id);if(!xml)throw Error('TEST_COLLECTION_XML_BYTES_REQUIRED');
  let visible='';for(let page=1;page<=document.numPages;page++){
   const content=await(await document.getPage(page)).getTextContent();
   visible+=content.items.filter((row):row is Extract<typeof row,{str:string}>=>'str'in row).map(row=>row.str).join(' ');
  }
  const decoded=new TextDecoder().decode(xml);
  for(const member of members){expect(visible).toContain('Auftrag '+member.number);expect(decoded).toContain(member.number);}
  expect((visible.match(/Leistungsdatum/gu)??[]).length).toBeGreaterThanOrEqual(3);
  const dir=path.resolve('.git/kreile-s38a-native-collection-evidence');mkdirSync(dir,{recursive:true});
  writeFileSync(path.join(dir,label+'.pdf'),bytes);writeFileSync(path.join(dir,label+'.xml'),xml);
  writeFileSync(path.join(dir,label+'.json'),JSON.stringify({invoiceId,tenant,pdfSha256:createHash('sha256').update(bytes).digest('hex'),source:'Actual native issue Action/Auth/DB original; initial historic TEST sources explicitly synthetic'},null,2));
  return decoded;
 }finally{await task.destroy();}
}

it('A12 native collection issues one real original: 33.33+33.33+33.34 has 19.00 VAT, all services, no representative order, exact fresh replay',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const input={collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()};
 const result=await withSession(full,()=>issueCollectionInvoiceAction(input));
 expect(result,JSON.stringify(result)).toMatchObject({code:'OK',replayed:false});
 if(result.code!=='OK')throw Error('TEST_NATIVE_COLLECTION_ISSUE:'+result.code);
 expect(result.receipt).toMatchObject({orderId:null,orderVersion:null,netAmountCents:10000,vatAmountCents:1900,grossAmountCents:11900,collection:{collectionId:source.collectionId,month:source.month,version:1}});
 expect(result.receipt.collection.members.map(row=>row.orderId).sort()).toEqual(source.members.map(row=>row.orderId).sort());
 const [stored]=await sql`SELECT order_id,freeze_id,service_date,snapshot,pdf_content,pdf_sha256,payment_open_amount_cents FROM public.invoices WHERE tenant_id=${tenant} AND id=${result.receipt.invoiceId}::uuid`;
 expect(stored).toMatchObject({order_id:null,freeze_id:null,service_date:null,payment_open_amount_cents:11900});
 expect(stored.snapshot.collection.members).toHaveLength(3);
 expect(createHash('sha256').update(stored.pdf_content).digest('hex')).toBe(stored.pdf_sha256);
 const xml=await inspectOriginal(new Uint8Array(stored.pdf_content),source.members,'a12',result.receipt.invoiceId);
 expect(xml).toContain('119.00');expect(xml).toContain('19.00');
 const retry=await withSession(full,()=>issueCollectionInvoiceAction(JSON.parse(JSON.stringify(input))));
 expect(retry).toEqual({...result,replayed:true});
 expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${source.customerId}`).toHaveLength(1);
 expect(await sql`SELECT status,invoice_id::text,version FROM public.invoice_collections WHERE tenant_id=${tenant} AND id=${source.collectionId}::uuid`).toEqual([{status:'abgerechnet',invoice_id:result.receipt.invoiceId,version:2}]);
 const [number]=await sql`SELECT last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant}`;
 expect(number.last_number).toBe(1);
});

it('A7/A8 real native two-rate invoice is once-only under parallel sessions and refuses another actor or reused stale version',async()=>{
 const source=await historicalCollection([1900,700,1900]);
 const before=await sql`SELECT last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant}`;
 const initialNumber=before.length===0?0:Number(before[0].last_number);
 const input={collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()};
 const results=await Promise.all([withSession(full,()=>issueCollectionInvoiceAction(input)),withSession(full,()=>issueCollectionInvoiceAction(JSON.parse(JSON.stringify(input))))]);
 const issued=results.find(row=>row.code==='OK'&&!row.replayed);
 expect(results.filter(row=>row.code==='OK'&&!row.replayed)).toHaveLength(1);
 expect(results.filter(row=>row.code==='OK'&&row.replayed)).toHaveLength(1);
 if(!issued||issued.code!=='OK')throw Error('TEST_COLLECTION_PARALLEL_ISSUE_REQUIRED:'+JSON.stringify(results));
 expect(issued.receipt).toMatchObject({netAmountCents:10000,vatAmountCents:1500,grossAmountCents:11500,orderId:null});
 const [stored]=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect([...stored.snapshot.totals.vatBreakdown].sort((a:{rateBp:number},b:{rateBp:number})=>a.rateBp-b.rateBp)).toEqual([{rateBp:700,netCents:3333,vatCents:233,grossCents:3566},{rateBp:1900,netCents:6667,vatCents:1267,grossCents:7934}]);
 await inspectOriginal(new Uint8Array(stored.pdf_content),source.members,'a7',issued.receipt.invoiceId);
 const other=await createFixture(['preise']);
 expect(await withSession(other,()=>issueCollectionInvoiceAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(full,()=>issueCollectionInvoiceAction({...input,expectedVersion:2}))).toMatchObject({code:'CONFLICT'});
 const noPrice=await createFixture(['wartung'],'developer');
 expect(await withSession(noPrice,()=>issueCollectionInvoiceAction(input))).toMatchObject({code:'FORBIDDEN'});
 const auth=await withSession(full,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_MEMBER_READ_AUTH_REQUIRED');
 const readInput={collectionId:source.collectionId,clientEventId:input.clientEventId};
 expect(await withSession(full,()=>getInvoiceReceiptAction(JSON.parse(JSON.stringify(readInput))))).toEqual({code:'OK',data:issued.receipt});
 expect(await withSession(other,()=>getInvoiceReceiptAction(readInput))).toEqual({code:'OK',data:issued.receipt});
 expect(await withSession(full,()=>getInvoiceReceiptAction({...readInput,collectionId:randomUUID()}))).toEqual({code:'OK',data:null});
 expect(await withSession(full,()=>getInvoiceReceiptAction({...readInput,orderId:source.members[0].orderId} as never))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(noPrice,()=>getInvoiceReceiptAction(readInput))).toMatchObject({code:'FORBIDDEN'});
 const pdf=await readInvoicePdf(auth.data,issued.receipt.invoiceId);
 expect(pdf.code).toBe('OK');if(pdf.code!=='OK')throw Error('TEST_NATIVE_ORIGINAL_READ_REQUIRED');
 expect(pdf.data.pdf).toEqual(stored.pdf_content);expect(pdf.data.pdfSha256).toBe(stored.pdf_sha256);
 const mapped=await withPrivilegedTenantTransaction(auth.data,tx=>tx.execute<{order_id:string;invoice_id:string;collection_id:string}>(statement`SELECT order_id,invoice_id::text,collection_id::text FROM private.v_invoice_order_members_v1 WHERE tenant_id=${tenant} AND invoice_id=${issued.receipt.invoiceId}::uuid`));
 expect(mapped.map(row=>row.order_id).sort()).toEqual(source.members.map(row=>row.orderId).sort());
 expect(mapped.every(row=>row.invoice_id===issued.receipt.invoiceId&&row.collection_id===source.collectionId)).toBe(true);
 await expect(sql.begin(async tx=>{await tx`UPDATE public.invoice_collections SET ziel_tage=45 WHERE tenant_id=${tenant} AND id=${source.collectionId}::uuid`;})).rejects.toThrow('append-only');
 await expect(sql.begin(async tx=>{
  // Raw schema-boundary attempt, not a product authorization proof. Give the
  // source validator its actual isolated tenant, so the member guard is reached.
  await tx`SELECT set_config('app.tenant_id',${tenant},true)`;
  await tx`DELETE FROM public.invoice_collection_orders WHERE tenant_id=${tenant} AND collection_id=${source.collectionId}::uuid`;
 })).rejects.toThrow('INVOICE_COLLECTION_MEMBERS_CHANGED');
 expect(await sql`SELECT id FROM public.invoices WHERE tenant_id=${tenant} AND customer_id=${source.customerId}`).toHaveLength(1);
 const [after]=await sql`SELECT snapshot,pdf_content,pdf_sha256 FROM public.invoices WHERE tenant_id=${tenant} AND id=${issued.receipt.invoiceId}::uuid`;
 expect(after).toEqual(stored);
 const [number]=await sql`SELECT last_number FROM private.invoice_number_sequences WHERE tenant_id=${tenant}`;
 expect(number.last_number).toBe(initialNumber+1);
});

it('native payment uses the existing payment command once and the global reader counts one fiscal invoice, not its three members',async()=>{
 const source=await historicalCollection([1900,1900,1900]);
 const issue=await withSession(full,()=>issueCollectionInvoiceAction({collectionId:source.collectionId,expectedVersion:1,clientEventId:randomUUID()}));
 if(issue.code!=='OK')throw Error('TEST_NATIVE_PAYMENT_ORIGINAL_REQUIRED:'+JSON.stringify(issue));
 const payer=await createFixture(['zahlungen'],'buero');
 const input={invoiceId:issue.receipt.invoiceId,amount:4000,method:'ueberweisung' as const,expectedVersion:0,expectedOpenAmountCents:11900,clientEventId:randomUUID()};
 const paid=await withSession(payer,()=>confirmPaymentAction(input));
 expect(paid,JSON.stringify(paid)).toMatchObject({code:'OK',receipt:{invoiceId:issue.receipt.invoiceId,orderId:null,collectionId:source.collectionId,amountCents:4000,paidAmountCents:4000,openAmountCents:7900,confirmedBy:payer.actorId}});
 if(paid.code!=='OK')throw Error('TEST_NATIVE_PAYMENT_REQUIRED');
 expect(await withSession(payer,()=>confirmPaymentAction(JSON.parse(JSON.stringify(input))))).toEqual({...paid,replayed:true});
 expect(await withSession(full,()=>confirmPaymentAction(input))).toMatchObject({code:'CONFLICT'});
 expect(await withSession(payer,()=>confirmPaymentAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT',currentOpenAmountCents:7900});
 expect(await withSession(payer,()=>confirmPaymentAction({...input,expectedVersion:1,expectedOpenAmountCents:7900,amount:7901,clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 const cashOnly=await createFixture(['kassieren','auftraege'],'werkstatt');
 expect(await withSession(cashOnly,()=>confirmPaymentAction({...input,method:'bar',clientEventId:randomUUID()}))).toMatchObject({code:'FORBIDDEN'});
 const auth=await withSession(payer,()=>resolveAuthorization());if(!auth.ok)throw Error('TEST_PAYMENT_READ_AUTH_REQUIRED');
 expect(auth.data.permissions).not.toContain('perm_view_prices');
 const summary=await readPaymentSummary(auth.data);expect(summary.code).toBe('OK');if(summary.code!=='OK')throw Error('TEST_NATIVE_PAYMENT_READ_REQUIRED');
 expect(summary.data.filter(row=>row.invoiceId===issue.receipt.invoiceId)).toMatchObject([{invoiceId:issue.receipt.invoiceId,orderId:null,totalAmountCents:11900,paidAmountCents:4000,openAmountCents:7900}]);
 expect(await sql`SELECT order_id,amount_eur::text FROM public.payments WHERE tenant_id=${tenant} AND invoice_id=${issue.receipt.invoiceId}::uuid`).toEqual([{order_id:null,amount_eur:'40.00'}]);
});
