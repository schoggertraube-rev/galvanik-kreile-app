import {afterEach,expect,it,vi} from 'vitest';
import type {PendingWorkshopOriginal} from '@/lib/offline/pendingStore';
import {syncPendingFiles} from '@/lib/offline/syncPendingFiles';
import {formatEuro} from '@/lib/domain/formatEuro';
import {CUSTOMER_CREDIT_COPY} from '@/ui/situationCatalog';
const ports=vi.hoisted(()=>({read:vi.fn(),claim:vi.fn(),ack:vi.fn()}));
vi.mock('@/lib/offline/pendingStore',async actual=>({...await actual<object>(),readPendingEntries:ports.read,claimPendingWorkshop:ports.claim,acknowledgePendingWorkshopOriginal:ports.ack}));
afterEach(()=>vi.resetAllMocks());
it('PL13:55 queues a financial follow-up after the active inventory, using the same dispatcher',async()=>{
 // Controlled queue/transport boundaries; actual algorithm, no product writer claim.
 const scope='a'.repeat(64),at='2026-11-14T00:00:00.000Z';
 const make=(id:string):PendingWorkshopOriginal=>({id,itemId:id,kind:'workshop',command:'invoice.cancel',deviceCapturedAt:at,input:{invoiceId:id,clientEventId:id,expectedVersion:1,reason:'TEST queued original'}});
 const first=make('11111111-1111-4111-8111-111111111111'),second=make('22222222-2222-4222-8222-222222222222');
 let inventory=[first];ports.read.mockImplementation(async()=>[...inventory]);ports.claim.mockImplementation(async(_scope,id)=>inventory.find(row=>row.id===id));ports.ack.mockImplementation(async(_scope,entry)=>{inventory=inventory.filter(row=>row.id!==entry.id);return true;});
 let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
 const workshop=vi.fn(async(_scope:string,entry:PendingWorkshopOriginal)=>{if(entry.id===first.id){entered();await gate;}return {code:'OK' as const,financialCommand:'invoice.cancel' as const,offlineReceipt:{scope,clientEventId:entry.id,deviceCapturedAt:at,eventId:'33333333-3333-4333-8333-333333333333',actorId:'44444444-4444-4444-8444-444444444444'}};});
 const dependencies={currentScope:()=>scope,workshop,saveNote:vi.fn(),prepare:vi.fn(),finish:vi.fn(),upload:vi.fn()} as unknown as Parameters<typeof syncPendingFiles>[1];
 const active=syncPendingFiles(scope,dependencies);await started;inventory.push(second);
 const follow=syncPendingFiles(scope,dependencies,{followUp:true});release();
 expect((await active).acknowledged).toBe(1);expect((await follow).acknowledged).toBe(1);
 expect(workshop.mock.calls.map(call=>call[1].id)).toEqual([first.id,second.id]);expect(inventory).toEqual([]);
});
it('uses the exact terminal-payment and queued-cancellation texts and one nonbreaking Euro formatter',()=>{
 expect(formatEuro(4000)).toBe('40,00\u00a0€');
 expect(CUSTOMER_CREDIT_COPY.tooHigh(formatEuro(4000))).toBe('Der Betrag ist höher als das Guthaben von 40,00\u00a0€.');
 expect(CUSTOMER_CREDIT_COPY.paymentUnknown).toBe('Die Zahlung zu dieser Rechnung ist nicht vollständig belegt. Erfass zuerst Betrag und Datum der Zahlung, dann storniere die Rechnung erneut.');
 expect(CUSTOMER_CREDIT_COPY.pending).toBe('Der Storno ist noch nicht übertragen. Er wird gesendet, sobald die Verbindung steht.');
});
