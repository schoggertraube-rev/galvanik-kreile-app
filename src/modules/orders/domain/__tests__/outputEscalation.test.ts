import {expect,it} from 'vitest';
import {compareDispatchBoardRank,dispatchBoardStep,planInitialDispatchReminder} from '../outputEscalation';
import type {DispatchPolicy} from '@/modules/fundament/public';
import {emptyDispatchPolicy} from '@/modules/fundament/public';

it('nennt je fertigem Auftrag den vorrangigen nächsten Schritt',()=>{
 const auftrag={orderId:'TEST-Auftrag',customerName:'TEST-Kunde',handover:null,blockReason:null,
  complaintIds:[],informed:false,releaseAllowed:false};
 expect(dispatchBoardStep({...auftrag,blockReason:'open_complaint',complaintIds:['TEST-Reklamation']}))
  .toEqual({orderId:auftrag.orderId,color:'rot',kind:'complaint',status:'Reklamation offen',
   action:'Reklamation bearbeiten',complaintIds:['TEST-Reklamation']});
 expect(dispatchBoardStep({...auftrag,blockReason:'overdue_invoice'})).toMatchObject({color:'rot',kind:'overdue'});
 expect(dispatchBoardStep(auftrag)).toEqual({orderId:auftrag.orderId,color:'rot',kind:'handover-mode',
  status:'Übergabeart fehlt',action:'Abholung oder Versand festlegen'});
 expect(dispatchBoardStep({...auftrag,handover:'shipping',blockReason:'payment'}))
  .toMatchObject({color:'rot',kind:'notify'});
 expect(dispatchBoardStep({...auftrag,handover:'shipping',informed:true,blockReason:'payment'}))
  .toMatchObject({color:'gelb',kind:'payment'});
 expect(dispatchBoardStep({...auftrag,handover:'shipping',informed:true,releaseAllowed:true}))
  .toMatchObject({color:'gruen',kind:'shipping',action:'Einpacken'});
});

it('zeigt freigegebene Ware zuerst und sortiert innerhalb der Gruppe nach Liegedauer',()=>{
 const neu={orderId:'TEST-neu',color:'gruen',readyAt:'2026-11-12T10:00:00Z',dueDate:'2026-11-13'} as const;
 const alt={...neu,orderId:'TEST-alt',readyAt:'2026-11-10T10:00:00Z',dueDate:'2026-11-14'} as const;
 const gesperrt={...alt,orderId:'TEST-gesperrt',color:'rot',readyAt:'2026-11-08T10:00:00Z'} as const;
 const ohneBeleg={...gesperrt,orderId:'TEST-ohne-Beleg',readyAt:null} as const;
 expect([neu,ohneBeleg,gesperrt,alt].sort(compareDispatchBoardRank).map(row=>row.orderId))
  .toEqual(['TEST-alt','TEST-neu','TEST-gesperrt','TEST-ohne-Beleg']);
});

it.each(['pickup','shipping',null] as const)('zeigt die rote Sperre bei fehlendem Freigabebeleg (%s)',handover=>{
 expect(dispatchBoardStep({orderId:'TEST-Auftrag',customerName:null,handover,blockReason:'not_frozen',
  informed:false,releaseAllowed:false,complaintIds:[]})).toEqual({orderId:'TEST-Auftrag',color:'rot',
  kind:'release-proof',status:'Freigabebeleg fehlt',action:'Freigabebeleg klären'});
});

it('E06 keeps the oldest open notice clock and every member when a later order joins or is notified',()=>{
 const input={tenantId:'TEST-tenant',customerId:'TEST-customer',handover:'pickup' as const,today:'2026-11-12',members:[{orderId:'TEST-old',orderNumber:'TEST-A1',noticeAt:'2026-11-09T10:00:00Z'},{orderId:'TEST-new',orderNumber:'TEST-A2',noticeAt:'2026-11-11T10:00:00Z'}]};
 const policy:DispatchPolicy={reminderDays:2,secondReminderDays:null,callAfterDays:null,storageAfterDays:null,blockAfterDueDays:null,unconfirmedDeliveryDays:null,holdMinutes:null,pickupWindows:[],holidays:[],carrierCutoffs:[],fallbackService:null};
 const single=planInitialDispatchReminder({...input,members:[input.members[0]]},policy),group=planInitialDispatchReminder(input,policy);
 expect(group).toMatchObject({state:'DUE',due:'2026-11-11',oldestNoticeAt:'2026-11-09T10:00:00Z',automaticSend:false,requiresResponseCheck:true});
 expect(group.clientKey).toBe(single.clientKey);expect(group.orderNumbers.sort()).toEqual(['TEST-A1','TEST-A2']);
 expect(planInitialDispatchReminder({...input,members:[input.members[0],{...input.members[1],noticeAt:null}]},policy)).toMatchObject({due:single.due,clientKey:single.clientKey,needsNotice:['TEST-new']});
 expect(planInitialDispatchReminder(input,null)).toMatchObject({state:'NEEDS_SETTING',due:null});
 expect(planInitialDispatchReminder({...input,today:'2026-11-10'},policy)).toMatchObject({state:'WAIT'});
});

it('a pickup agreement removes only its own reminder clock and collective contact names only the remaining ware',()=>{
 const input={tenantId:'TEST-tenant',customerId:'TEST-customer',handover:'pickup' as const,today:'2026-11-11',members:[{orderId:'TEST-agreed',orderNumber:'TEST-A1',noticeAt:'2026-11-02T10:00:00Z'},{orderId:'TEST-open',orderNumber:'TEST-A2',noticeAt:'2026-11-10T10:00:00Z'}],pausedOrderIds:['TEST-agreed']};
 const plan=planInitialDispatchReminder(input,{...emptyDispatchPolicy(),reminderDays:2});
 expect(plan).toMatchObject({state:'WAIT',due:'2026-11-12',anchorOrderId:'TEST-open',orderIds:['TEST-open'],orderNumbers:['TEST-A2'],needsNotice:[]});
 expect(planInitialDispatchReminder({...input,pausedOrderIds:['TEST-agreed','TEST-open']},{...emptyDispatchPolicy(),reminderDays:2})).toMatchObject({clientKey:null,due:null});
});
