import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {customerFixture} from './orderFixture';
import {requestMailStep} from './requestMailStep';

// Prefix stops at the first red boundary; not a full H1 PASS.
it('H1 prefix T25 to KV: original mail creates one linked quote; the concern closes and retry does not duplicate',async()=>{
 const itemId=await requestMailStep('H1');
 const customerId=await customerFixture('H1-KV');
 const {getIntakeCaptureAction,finishIntakeUseAction,setIntakeNoBusinessAction}=await import('@/app/actions/eingang.actions');
 const source=await withSession(full,()=>getIntakeCaptureAction(itemId));
 expect(source.code).toBe('OK');if(source.code!=='OK')throw Error('H1_SOURCE:'+source.code);
 for(const kind of ['info','erledigt'] as const){
  const key=randomUUID();
  expect(await withSession(full,()=>finishIntakeUseAction({items:[{itemId,version:source.capture.version}],clientEventId:key,kind,note:'TEST fachlicher KV fehlt noch'}))).toMatchObject({code:'VALIDATION_ERROR'});
  expect(await sql`SELECT version,einsatz,anliegen_offen FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{version:source.capture.version,einsatz:'offen',anliegen_offen:['kv_anfrage']}]);
  expect(await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${key}::uuid`).toEqual([{n:0}]);
 }
 const noBusinessKey=randomUUID();
 expect(await withSession(full,()=>setIntakeNoBusinessAction({itemId,version:source.capture.version,clientEventId:noBusinessKey,reason:'info'}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${noBusinessKey}::uuid`).toEqual([{n:0}]);
 const {createQuoteAction,readQuoteAction,readQuotePdfAction}=await import('@/app/actions/quotes.actions');
 const input={clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST H1 KV aus echtem Original',positions:[{name:'TEST Trompete',quantity:4,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:10000}],source:{itemId,version:source.capture.version,message:true}};
 const created=await withSession(full,()=>createQuoteAction(input));
 expect(created.code).toBe('OK');if(created.code!=='OK')throw Error('H1_KV:'+created.code);
 expect(created.quote.lifecycle).toMatchObject({edition:1,sourceItemId:itemId,acceptedEdition:null});
 expect(await sql`SELECT kunde_id,vorgang_art,vorgang_id,anliegen_offen,einsatz FROM public.intake_item WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}::uuid`).toEqual([{kunde_id:customerId,vorgang_art:'kv',vorgang_id:created.quote.quoteId,anliegen_offen:[],einsatz:'erledigt'}]);
 expect(await sql`SELECT von::text,nachher->>'action' AS action FROM public.intake_event WHERE tenant_id=${KREILE_TENANT_SLUG} AND item_id=${itemId}::uuid AND befehl_id=${input.clientEventId}::uuid`).toEqual([{von:full.actorId,action:'kv.angelegt'}]);
 expect(await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:1}});
 expect(await withSession(full,()=>getIntakeCaptureAction(itemId))).toMatchObject({code:'OK',capture:{usage:'erledigt',openConcerns:[]}});
 expect(await withSession(full,()=>createQuoteAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,quote:{quoteId:created.quote.quoteId}});
 expect(await withSession(full,()=>createQuoteAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT'});
 expect(await sql`SELECT count(*)::integer AS n FROM private.quotes WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.orders WHERE tenant_id=${KREILE_TENANT_SLUG} AND customer_id=${customerId}`).toEqual([{n:0}]);
 // Synthetic company fixture only; PDF itself uses the actual action, reads and renderer.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,iban,bic,bank_name,tax_id,invoice_vat_rate_basis_points,invoice_payment_term_days)
 SELECT ${randomUUID()},${KREILE_TENANT_SLUG},'TEST Ablauf Galvanik','TEST Weg 1','70176','Stuttgart','Deutschland','DE02120300000000202051','BYLADEM1001','TEST Bank','DE123456789',1900,14
 WHERE NOT EXISTS(SELECT 1 FROM public.company_settings WHERE tenant_id=${KREILE_TENANT_SLUG})`;
 const pdf=await withSession(full,()=>readQuotePdfAction({quoteId:created.quote.quoteId}));
 expect(pdf.code).toBe('OK');if(pdf.code!=='OK')throw Error('H1_PDF:'+pdf.code);
 expect(pdf.pdf.subarray(0,5).toString()).toBe('%PDF-');
 expect(pdf.document).toMatchObject({id:created.quote.quoteId,customerId,version:1,edition:1,linkedOrderId:null});
 expect(await withSession(full,()=>readQuoteAction({quoteId:created.quote.quoteId}))).toMatchObject({code:'OK',quote:{version:1,lifecycle:{sentEdition:null}}});
});
