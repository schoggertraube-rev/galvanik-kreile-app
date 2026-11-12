import {AsyncLocalStorage} from 'node:async_hooks';
// @vitest-environment node
import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {afterAll,expect,it} from 'vitest';
import {readCustomerListSignals,readCustomerSummary} from '@/lib/server/customerSummaryRead';
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';

const url=process.env.DATABASE_URL;
if(!url||url!==process.env.H18_EXPECTED_DATABASE_URL||new URL(url).hostname!=='127.0.0.1'||new URL(url).pathname!=='/postgres')throw Error('R53_LOCAL_REPLAY_REQUIRED');
const db=postgres(url,{max:1});
afterAll(async()=>{await db.end();});
it('reads actual hints in one tenant projection and withholds money and mail facts before the response',async()=>{
 const actor=randomUUID(),customer=randomUUID(),tenant=KREILE_TENANT_SLUG;
 await db.begin(async tx=>{
  await tx`INSERT INTO public.app_users(id,tenant_id,email,full_name,role,active) VALUES(${actor}::uuid,${tenant},${'TEST-r53-'+actor+'@local.invalid'},'TEST R53 Leser','meister',true)`;
  await tx`INSERT INTO public.customers(id,tenant_id,customer_number,name,company_name,type,contact_person,email,phone,street,house_number,zip_code,city,country,payment_preference,source,first_name,last_name,salutation)
   VALUES(${customer},${tenant},${'TEST-R53-'+customer},'TEST R53 Kunde','TEST R53 GmbH','business','Ada Test',${'TEST-'+customer+'@local.invalid'},'+49 711 5550192','Testweg','53','70178','Stuttgart','DE','bar','manual','Ada','Test','ohne')`;
  await tx`INSERT INTO public.customer_agreements(id,tenant_id,customer_id,order_id,position,bezeichnung,wert,geld,hinweis,created_by,version)
    VALUES(${randomUUID()}::uuid,${tenant},${customer},NULL,1,'TEST Geld-Grund','TEST nur mit Geld',true,true,${actor}::uuid,1),
    (${randomUUID()}::uuid,${tenant},${customer},NULL,2,'TEST Sichtbar','TEST Verpackung',false,true,${actor}::uuid,1)`;
  await tx`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,richtung,quelle,erstellt_von,text,kunde_id,zuordnung,einsatz)
    VALUES(${randomUUID()}::uuid,${tenant},${randomUUID()},'notiz','intern','geraet',${actor}::uuid,'TEST offene Nachricht',${customer},'hand','offen')`;
 });
 const auth:AuthorizationSnapshot={tenantId:tenant,userId:actor,displayName:'TEST R53 Leser',role:'meister',active:true,areas:['kunden'],permissions:[]};
 const restricted=(await readCustomerListSignals(auth,[customer],(await import('@/modules/eingang/server-public')).openIntakePredicate())).get(customer);
 expect(restricted).toMatchObject({activeOrderCount:0,activeQuoteCount:0});
 expect(restricted?.hints).toContainEqual({kind:'agreement',text:'TEST Sichtbar: TEST Verpackung',urgent:false});
 expect(JSON.stringify(restricted)).not.toContain('TEST nur mit Geld');
 expect(restricted?.hints.some(hint=>hint.kind==='message'||hint.kind==='payment')).toBe(false);
 const allowed=(await readCustomerListSignals({...auth,areas:['kunden','geld','mails']},[customer],(await import('@/modules/eingang/server-public')).openIntakePredicate())).get(customer);
 expect(allowed?.hints).toContainEqual({kind:'agreement',text:'TEST Geld-Grund: TEST nur mit Geld',urgent:false});
 expect(allowed?.hints).toContainEqual({kind:'message',text:'1 Nachricht offen',urgent:false});
 expect((await readCustomerListSignals({...auth,tenantId:'TEST-r53-other-tenant'},[customer],(await import('@/modules/eingang/server-public')).openIntakePredicate())).size).toBe(0);
 // The card and the hint projection must enforce the same existing money area.
 // Even a zero amount is a financial fact; absence must not become a fake zero.
 const card=await readCustomerSummary(auth,{customerId:customer},(await import('@/modules/eingang/server-public')).openIntakePredicate());
 expect(card.code).toBe('OK');
 if(card.code!=='OK')throw Error('TEST_CUSTOMER_CARD_READ:'+card.code);
 expect(card.data).not.toHaveProperty('invoiceRevenueCents');
 expect(card.data).not.toHaveProperty('invoiceOpenCents');
 expect(await readCustomerSummary({...auth,areas:['kunden','geld']},{customerId:customer},(await import('@/modules/eingang/server-public')).openIntakePredicate()))
  .toMatchObject({code:'OK',data:{invoiceRevenueCents:0,invoiceOpenCents:0}});
 expect(await readCustomerSummary({...auth,areas:[]},{customerId:customer},(await import('@/modules/eingang/server-public')).openIntakePredicate())).toMatchObject({code:'FORBIDDEN'});
});

(globalThis as typeof globalThis & {AsyncLocalStorage:typeof AsyncLocalStorage}).AsyncLocalStorage=AsyncLocalStorage;
