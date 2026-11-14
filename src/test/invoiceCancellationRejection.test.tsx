import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {InvoicesClient} from '@/app/buchhaltung/rechnungen/InvoicesClient';
import type {ImmutableInvoiceSummary} from '@/lib/server/invoiceRead';

const ports=vi.hoisted(()=>({queue:vi.fn(),read:vi.fn(),receipt:vi.fn()}));
vi.mock('@/lib/offline/queueFinancialCommand',()=>({queueFinancialCommand:ports.queue}));
vi.mock('@/app/actions/invoices.actions',()=>({getInvoiceSummariesAction:ports.read,getInvoiceCancellationReceiptAction:ports.receipt}));
vi.mock('@/hooks/useHydrated',()=>({useHydrated:()=>true}));
vi.mock('@/lib/auth/PermissionsContext',()=>({usePermissions:()=>({offlineScope:'a'.repeat(64)})}));

// Explicit synthetic consumer boundary; real financial writer/receipt proofs live in acceptance.
const row:ImmutableInvoiceSummary={invoiceId:'11111111-1111-4111-8111-111111111111',invoiceNumber:'TEST-R1',orderId:'22222222-2222-4222-8222-222222222222',orderNumber:'TEST-A1',customerId:'TEST-customer',customerName:'TEST consumer',status:'issued',aggregateVersion:1,orderVersion:3,netAmountCents:10000,vatRateBasisPoints:1900,vatGroups:[{rateBp:1900,netCents:10000,vatCents:1900,grossCents:11900}],vatAmountCents:1900,grossAmountCents:11900,serviceDate:'2026-11-14',dueDate:'2026-11-28',issuedAt:'2026-11-14T10:00:00Z',originalPdfRef:'TEST-original',originalPdfSha256:'a'.repeat(64),cancelledAt:null,cancelledBy:null,cancelReason:null,cancellationPdfRef:null,cancellationPdfSha256:null};
afterEach(()=>{cleanup();vi.resetAllMocks();});

it('new explicit confirmation gets a fresh key and reread version after terminal rejection; ambiguity keeps that key',async()=>{
 ports.read.mockResolvedValue({code:'OK',data:[{...row,aggregateVersion:2}]});
 ports.queue.mockImplementationOnce(async(_scope,command)=>({code:'CONFLICT',message:'TEST terminal rejection',rejectionReceipt:{clientEventId:command.input.clientEventId}}))
  .mockResolvedValue({code:'UNAVAILABLE',message:'TEST uncertain outcome'});
 render(<InvoicesClient initialState={{state:'DATA',data:[row],canCancel:true}}/>);
 fireEvent.change(screen.getByLabelText('Stornogrund'),{target:{value:'TEST actual retained reason'}});
 fireEvent.click(screen.getByRole('button',{name:'Rechnung stornieren'}));
 await screen.findByText('TEST terminal rejection');
 expect(ports.receipt).not.toHaveBeenCalled();expect(ports.read).toHaveBeenCalledTimes(1);
 const first=ports.queue.mock.calls[0][1].input;
 fireEvent.click(screen.getByRole('button',{name:'Rechnung stornieren'}));
 await screen.findByText('TEST uncertain outcome');
 const second=ports.queue.mock.calls[1][1].input;
 expect(second).toMatchObject({expectedVersion:2,reason:first.reason,invoiceId:first.invoiceId});
 expect(second.clientEventId).not.toBe(first.clientEventId);
 fireEvent.click(screen.getByRole('button',{name:'Rechnung stornieren'}));
 await waitFor(()=>expect(ports.queue).toHaveBeenCalledTimes(3));
 expect(ports.queue.mock.calls[2][1].input.clientEventId).toBe(second.clientEventId);
 expect(ports.read).toHaveBeenCalledTimes(1);expect(ports.receipt).not.toHaveBeenCalled();
});
