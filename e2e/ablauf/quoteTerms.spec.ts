import {randomUUID} from 'node:crypto';
import {expect,it} from 'vitest';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession} from './replayHarness';
import {customerFixture} from './orderFixture';

it('H1 new quote revisions bind unit, position minutes and company VAT instead of reading later settings',async()=>{
 const customerId=await customerFixture('H1-Terms');
 // Isolated TEST configuration; the quote write and read ports themselves are real.
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,invoice_vat_rate_basis_points) VALUES(${randomUUID()},${KREILE_TENANT_SLUG},'TEST KV Satz',700)`;
 const {createQuoteAction,readQuoteAction,updateQuoteAction}=await import('@/app/actions/quotes.actions');
 const position={name:'TEST Fassung Teil',quantity:4,material:'Messing',surfaceRequested:'verchromen',unitPriceCents:2500,lineTotalCents:10000,unit:'stueck',plannedMinutes:120};
 const input={clientEventId:randomUUID(),customerId,dueDate:'2027-05-15',note:'TEST gebundene Fassung',positions:[position]};
 const created=await withSession(full,()=>createQuoteAction(input));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK',quote:{positions:[{unit:'stueck',plannedMinutes:120,vatRateBasisPoints:700}]}});
 if(created.code!=='OK')throw Error('H1_TERMS_CREATE:'+created.code);
 const quoteId=created.quote.quoteId;
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=1900 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{positions:[{unit:'stueck',plannedMinutes:120,vatRateBasisPoints:700}]}});
 expect(await withSession(full,()=>createQuoteAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,quote:{positions:[{vatRateBasisPoints:700}]}});
 const update={quoteId,expectedVersion:1,clientEventId:randomUUID(),dueDate:'2027-05-15',note:input.note,positions:[{...position,plannedMinutes:90}]};
 const changed=await withSession(full,()=>updateQuoteAction(update));
 expect(changed).toMatchObject({code:'OK',quote:{version:2,positions:[{unit:'stueck',plannedMinutes:90,vatRateBasisPoints:1900}]}});
 expect(await sql`SELECT revision,unit,aufwand_min,vat_rate_basis_points FROM private.quote_positions WHERE tenant_id=${KREILE_TENANT_SLUG} AND quote_id=${quoteId}::uuid ORDER BY revision`).toEqual([{revision:1,unit:'stueck',aufwand_min:120,vat_rate_basis_points:700},{revision:2,unit:'stueck',aufwand_min:90,vat_rate_basis_points:1900}]);
 expect(await withSession(full,()=>readQuoteAction({quoteId}))).toMatchObject({code:'OK',quote:{positions:[{plannedMinutes:90}]}});
 expect(await withSession(full,()=>updateQuoteAction(structuredClone(update)))).toMatchObject({code:'OK',replayed:true});
 await sql`UPDATE public.company_settings SET invoice_vat_rate_basis_points=700 WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const {unit:_unit,plannedMinutes:_minutes,...legacyPosition}=position;void _unit;void _minutes;
 expect(await withSession(full,()=>updateQuoteAction({quoteId,expectedVersion:2,clientEventId:randomUUID(),dueDate:'2027-05-20',note:input.note,positions:[legacyPosition]}))).toMatchObject({code:'OK',quote:{version:3,positions:[{unit:'stueck',plannedMinutes:90,vatRateBasisPoints:1900}]}});
});
