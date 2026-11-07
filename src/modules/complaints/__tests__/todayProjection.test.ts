import {describe,expect,it} from 'vitest';
import type {Complaint} from '../contract';
import {complaintAttention} from '../todayProjection';

const row:Complaint={id:'TEST-complaint',customerId:'TEST-customer',orderId:'TEST-order',itemId:null,legacyPositionId:null,reason:'Blasen',stationId:null,description:'TEST Reklamation',photoIds:[],createdAt:'2026-11-02T10:00:00Z',resolvedAt:null,resolution:null,status:'open',nummer:'RK-TEST',stand:'aufgenommen',orderNumber:'A-TEST',customerName:'TEST Kunde',mangel:'Blasen'};
describe('4.8 next actions from one stored complaint projection',()=>{
 it('gives each open state its bound next action only to the responsible area and removes closed cases',()=>{
  expect(complaintAttention([row],['entscheiden'],'2026-11-06')).toMatchObject([{key:'reklamation_entscheiden:TEST-complaint',actionLabel:'Ergebnis festlegen',target:{screen:'reklamation',arg:row.id}}]);
  expect(complaintAttention([row],['kunden'],'2026-11-06')).toEqual([]);
  expect(complaintAttention([{...row,stand:'massnahme_gutschrift',gutschriftBetrag:'50.00'}],['geld'],'2026-11-06')).toMatchObject([{actionLabel:'Gutschrift erteilen'}]);
  expect(complaintAttention([{...row,stand:'kunde_informieren'}],['kunden'],'2026-11-06')).toMatchObject([{actionLabel:'Kunde informieren'}]);
  expect(complaintAttention([{...row,stand:'abgeschlossen'}],['geld','kunden','entscheiden'],'2026-11-06')).toEqual([]);
 });
 it('escalates running rework and derives the missing-goods reminder from its real warehouse date',()=>{
  const running:Complaint={...row,stand:'massnahme_nacharbeit',nacharbeitAuftragId:'TEST-rework',reworkGoods:'erwartet',reworkGoodsSince:'2026-10-12T08:00:00Z',reworkNumber:'A-TEST-N',reworkStation:'angenommen'};
  const result=complaintAttention([running],['entscheiden','kunden'],'2026-11-06');
  expect(result).toHaveLength(1); // One main action per object, including a login with both areas.
  expect(result).toEqual(expect.arrayContaining([expect.objectContaining({key:'nacharbeit_ware_fehlt:TEST-complaint',actionLabel:'Kunde erinnern',target:{screen:'mail',arg:'TEST-rework#auftragsbestaetigung'}})]));
  expect(complaintAttention([{...running,createdAt:'2026-10-12T08:00:00Z'}],['entscheiden'],'2026-11-06')[0].urgency).toBe('conflict');
  expect(complaintAttention([{...running,reworkGoods:'da'}],['kunden'],'2026-11-06')).toEqual([]);
 });
});
