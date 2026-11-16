// Synthetic qualified-port rows only: tests the real calendar projection,
// not invoice issuance, authorization, payment or database persistence.
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/app/actions/invoices.actions',()=>({getInvoiceTruthAction:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:()=>{throw Error('TEST_UNEXPECTED_LEGACY_CLIENT');}}));
vi.mock('@/db',()=>({db:new Proxy({},{get(){throw Error('TEST_UNEXPECTED_DATABASE_CALL');}})}));
import {getInvoiceTruthAction} from '@/app/actions/invoices.actions';
import type {InvoiceTruthRow} from '@/lib/server/invoiceTruthRead';
import {listRechnungenAction,listOffenePostenAction} from '../actions';

afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
it.each([
 {name:'summer23:30',now:'2026-07-14T21:30:00.000Z',due:'2026-07-14',overdue:false},
 {name:'summer00:30',now:'2026-07-14T22:30:00.000Z',due:'2026-07-14',overdue:true},
 {name:'winter23:30',now:'2026-01-14T22:30:00.000Z',due:'2026-01-14',overdue:false},
 {name:'winter00:30',now:'2026-01-14T23:30:00.000Z',due:'2026-01-14',overdue:true},
])('K13K-5 invoice filter and displayed status use Berlin $name',async({now,due,overdue})=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date(now));
 const invoice:InvoiceTruthRow={invoiceId:'TEST-calendar-invoice',invoiceNumber:'TEST-calendar-number',customerId:'TEST-calendar-customer',orderId:'TEST-calendar-order',status:'issued',netAmountCents:10000,vatRateBasisPoints:1900,vatGroups:[{rateBp:1900,netCents:10000,vatCents:1900,grossCents:11900}],vatAmountCents:1900,grossAmountCents:11900,dueDate:due,issuedAt:'2026-01-01T12:00:00Z',paymentStatus:'offen',paidAmountCents:0,openAmountCents:11900};
 vi.mocked(getInvoiceTruthAction).mockResolvedValue({code:'OK',data:[invoice]});
 expect(await listRechnungenAction({ueberfaellig:true})).toHaveLength(overdue?1:0);
 expect(await listRechnungenAction({status:'ueberfaellig'})).toHaveLength(overdue?1:0);
 expect(await listOffenePostenAction()).toMatchObject([{id:invoice.invoiceId,status:overdue?'ueberfaellig':'offen',faelligAm:due,datum:'2026-01-01'}]);
});
