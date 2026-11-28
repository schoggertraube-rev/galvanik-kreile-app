// @vitest-environment node
import {randomUUID} from 'node:crypto';
import {expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../../e2e/ablauf/replayHarness';
import {getIntakeDraftsAction,loeseEntwurfskonfliktAction,saveIntakeDraftAction} from '@/app/actions/eingang.actions';

it('bietet bei zwei Fassungen beide Eingaben an und speichert die Wahl höchstens einmal',async()=>{
 const id=randomUUID(),clientKey=randomUUID(),first={payload:{clientKey,text:'TEST Erste Fassung'},lastField:null};
 const newer={payload:{clientKey,text:'TEST Vom anderen Gerät'},lastField:'eingang.menge'};
 const mine={payload:{clientKey,text:'TEST Meine Fassung'},lastField:'eingang.text'};
 const save=(stand:typeof first|typeof newer|typeof mine,expectedVersion:number|null)=>withSession(full,()=>saveIntakeDraftAction({
  id,art:'eingang',clientEventId:randomUUID(),expectedVersion,...stand,
 }));
 expect(await save(first,null)).toMatchObject({code:'OK',drafts:[{id,version:0}]});
 expect(await save(newer,0)).toMatchObject({code:'OK',drafts:[{id,version:1}]});
 expect(await save(mine,0)).toMatchObject({code:'CONFLICT',neuere:{version:1,stand:newer},meine:{stand:mine}});
 const wahl={draftId:id,clientEventId:randomUUID(),expectedVersion:1};
 expect(await withSession(full,()=>loeseEntwurfskonfliktAction({...wahl,wahl:'neuere'})))
  .toMatchObject({code:'OK',draft:{version:1,stand:newer}});
 const other=await createFixture(['eingang']);
 expect(await withSession(other,()=>loeseEntwurfskonfliktAction({...wahl,wahl:'meine',stand:mine})))
  .toMatchObject({code:'NOT_FOUND'});
 expect(await withSession(full,getIntakeDraftsAction)).toMatchObject({code:'OK',drafts:[{id,version:1,payload:newer.payload}]});
 const keep={...wahl,clientEventId:randomUUID(),wahl:'meine',stand:mine};
 for(let attempt=0;attempt<2;attempt++)expect(await withSession(full,()=>loeseEntwurfskonfliktAction(JSON.parse(JSON.stringify(keep)))))
  .toMatchObject({code:'OK',draft:{version:2,stand:mine}});
 expect(await withSession(full,()=>loeseEntwurfskonfliktAction({...wahl,clientEventId:randomUUID(),wahl:'neuere'})))
  .toMatchObject({code:'CONFLICT',neuere:{version:2,stand:mine}});
 expect(await sql`SELECT id FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${keep.clientEventId}::uuid
  AND event_type='INTAKE_DRAFT_SAVED_V1'`).toHaveLength(1);
});
