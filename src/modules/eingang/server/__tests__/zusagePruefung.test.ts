// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../../../../e2e/ablauf/replayHarness';
import {customerFixture,intakeOrderFixture} from '../../../../../e2e/ablauf/orderFixture';
import {resolveAuthorization} from '@/lib/server/authorization';
import {readCustomerDeliveryBlock} from '@/lib/server/paymentSummaryRead';
import {pruefeZusage} from '../zusagePruefung';

it('reads customer-wide debt from the actual invoice source without exposing it to a mail-only financial context',async()=>{
  const customerId=await customerFixture('TEST S-1 Zahlungsvoraussetzung');
  const affected=await intakeOrderFixture('TEST S-1 Abholauftrag',customerId);
  const historicalOrder=await intakeOrderFixture('TEST S-1 Altauftrag',customerId);
  const orderId=affected.receipt.orderId;
  const input={art:'herausgabe' as const,customerId,orderId};
  const authorized=await withSession(full,()=>resolveAuthorization());
  if(!authorized.ok)throw Error('TEST_S1_AUTH_REQUIRED');
  const auth=authorized.data;
  expect(await pruefeZusage(auth,input)).toEqual({frei:true});

  // Explicit synthetic historical debt, matching the existing W-AUSGANG fixture.
  const invoiceId=randomUUID();
  await sql`INSERT INTO public.invoices(id,tenant_id,order_id,customer_id,invoice_number,amount_total,status,
    due_date,gross_amount_cents,payment_contract_version,payment_mode,payment_status,payment_open_amount_cents,
    payment_paid_amount_cents,payment_currency,payment_version)
    VALUES(${invoiceId}::uuid,${tenant},${historicalOrder.receipt.orderId},${customerId},'R-2025-0812',60,'issued',
      (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date-1,6000,1,'rechnung','offen',6000,0,'EUR',0)`;

  expect(await readCustomerDeliveryBlock(auth,customerId,orderId)).toMatchObject({code:'OK',paymentMode:'rechnung',
    data:{blocked:true,invoiceIds:[invoiceId]},oldest:{number:'R-2025-0812',openAmountCents:6000,daysOverdue:1}});
  expect(await pruefeZusage(auth,input)).toMatchObject({frei:false,grund:'liefersperre',
    ausweg:{befehl:'confirmPaymentAction',text:expect.stringContaining('R-2025-0812')}});

  const mailOperator=await createFixture(['mails','auftraege'],'werkstatt');
  const limited=await withSession(mailOperator,()=>resolveAuthorization());
  if(!limited.ok)throw Error('TEST_S1_OPERATOR_AUTH_REQUIRED');
  const hidden=await readCustomerDeliveryBlock(limited.data,customerId,orderId);
  expect(hidden).toMatchObject({code:'OK',data:{blocked:true,invoiceIds:[]}});
  expect(hidden).not.toHaveProperty('oldest');
  expect(await pruefeZusage(limited.data,input)).toMatchObject({frei:false,grund:'liefersperre',text:'Abholung erst nach Zahlung.'});
  expect(await pruefeZusage(limited.data,{art:'preis_im_text'})).toMatchObject({frei:false,grund:'preisrecht'});
  expect(await pruefeZusage(auth,{...input,orderId:randomUUID()})).toMatchObject({frei:false,grund:'unbekannt'});
});
