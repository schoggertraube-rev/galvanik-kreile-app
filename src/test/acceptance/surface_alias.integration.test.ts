// @vitest-environment node
import {expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {full,sql,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {customerFixture} from '../../../e2e/ablauf/orderFixture';
import {createOrderIntakeAction} from '@/app/actions/eingang.actions';
import {getLiveOrderCardAction,getTodayOrderReadAction,changeOrderContentAction} from '@/app/actions/orders.actions';
import {ORDER_POSITION_SURFACES,ORDER_POSITION_SURFACE_ALIASES,normaliseOrderPositionSurface,orderPositionSurfaceLabel,suggestOrderPositionSurface} from '@/lib/orderPositionContract';
import {resolveAuthorization} from '@/lib/server/authorization';
import {loadOfficeHome} from '@/lib/server/officeHomeRead';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
const database=process.env.DATABASE_URL;
if(!database||database!==process.env.H18_EXPECTED_DATABASE_URL||new URL(database).hostname!=='127.0.0.1'||!['54322','54342'].includes(new URL(database).port)||new URL(database).pathname!=='/postgres')throw Error('TEST_ALIAS_APPROVED_REPLAY_REQUIRED');

it('251 one shared vocabulary maps zero/one/many legacy inputs identically in TypeScript and actual SQL, while unknown stays refused',async()=>{
 const cases:Array<{input:string;key:string}>=ORDER_POSITION_SURFACES.flatMap(option=>[{input:option.key,key:option.key},{input:option.label,key:option.key}]);
 cases.push(...ORDER_POSITION_SURFACE_ALIASES.map(option=>({input:option.alias,key:option.key})));
 for(const inputs of [[],['chrom'],cases.map(row=>row.input)]){
  const rows=await sql`SELECT input,private.order_position_surface_key(input) AS key FROM unnest(${sql.array(inputs)}::text[]) AS source(input)`;
  expect(rows).toHaveLength(inputs.length);
  expect(rows.map(row=>row.key)).toEqual(inputs.map(value=>normaliseOrderPositionSurface(value)));
 }
 expect(normaliseOrderPositionSurface('chrom')).toBe('verchromen');
 expect(orderPositionSurfaceLabel('chrom')).toBe('Verchromen');
 expect(normaliseOrderPositionSurface('TEST_unbekannte_Oberflaeche')).toBeNull();
 expect(suggestOrderPositionSurface('TEST_unbekannte_Oberflaeche')).toBeNull();
 expect(suggestOrderPositionSurface('TEST chrom Spezial')).toBe('verchromen');
 expect(suggestOrderPositionSurface('TEST chrom verzinken')).toBeNull();
 expect(suggestOrderPositionSurface('TEST chrombad')).toBeNull();
 expect(()=>orderPositionSurfaceLabel('TEST_unbekannte_Oberflaeche')).toThrow('ORDER_POSITION_SURFACE_UNKNOWN');
 await expect(sql`SELECT private.order_position_surface_key('TEST_unbekannte_Oberflaeche')`).rejects.toMatchObject({code:'22023'});
 const [grants]=await sql`SELECT has_function_privilege('anon','private.order_position_surface_key(text)','EXECUTE') AS anon,has_function_privilege('authenticated','private.order_position_surface_key(text)','EXECUTE') AS authenticated,has_function_privilege('service_role','private.order_position_surface_key(text)','EXECUTE') AS service`;
 expect(grants).toEqual({anon:false,authenticated:false,service:true});
});

it('251 actual intake alias, unchanged historical original, fresh retry and zero/one/many qualified Today cards share the same label',async()=>{
 const customerId=await customerFixture('TEST 251 legacy surface');
 const dueDate=new Date(Date.now()+7*86_400_000).toISOString().slice(0,10);
 const input={geprueft:true,clientEventId:randomUUID(),customer:{mode:'EXISTING' as const,customerId},dueDate,termStatus:'bestaetigt' as const,intakeSource:'persoenlich' as const,handoverMode:'pickup' as const,paymentMode:'rechnung' as const,note:'TEST 251 actual alias intake',items:[{catalogServiceId:null,name:'TEST 251 chrom Teil',quantity:1,material:'Messing',surfaceRequested:'chrom',executionRequested:'offen' as const,unit:'Stück',unitPriceCents:10000,vatRateBasisPoints:1900}]};
 const created=await withSession(full,()=>createOrderIntakeAction(input));
 expect(created,JSON.stringify(created)).toMatchObject({code:'OK',replayed:false});
 if(created.code!=='OK')throw Error('TEST_ALIAS_REAL_INTAKE_REQUIRED');
 const replayed=await withSession(full,()=>createOrderIntakeAction(JSON.parse(JSON.stringify(input))));
 expect(replayed).toMatchObject({code:'OK',receipt:created.receipt,replayed:true});
 const sourceId=created.receipt.orderId,oldItem=created.receipt.items[0].id,legacy=randomUUID(),newItem=randomUUID(),eventId=randomUUID(),requestId=randomUUID();
 // Explicit synthetic append-only historical foundation, as in the existing B1
 // test. No immutable original, trigger, permission or product writer is edited.
 const unknown=randomUUID(),unknownItem=randomUUID(),unknownEvent=randomUUID();
 for(const fixture of [{id:legacy,item:newItem,event:eventId,request:requestId,raw:'chrom'},{id:unknown,item:unknownItem,event:unknownEvent,request:randomUUID(),raw:'TEST_unbekannte_Oberflaeche'}])await sql.begin(async seed=>{
  const legacy=fixture.id,newItem=fixture.item,eventId=fixture.event,requestId=fixture.request;
  await seed`INSERT INTO public.orders SELECT (jsonb_populate_record(NULL::public.orders,to_jsonb(source.*)||jsonb_build_object('id',${legacy}::text,'order_number',regexp_replace(source.order_number,'^A-[0-9]{4}-',${fixture.raw==='chrom'?'A-1900-':'A-1901-'}),'print_symbol_slot',NULL,'print_symbol_generation',NULL,'print_symbol_active',false))).* FROM public.orders source WHERE tenant_id=${tenant} AND id=${sourceId}`;
  await seed`INSERT INTO public.items SELECT (jsonb_populate_record(NULL::public.items,to_jsonb(source.*)||jsonb_build_object('id',${newItem}::text,'order_id',${legacy}::text))).* FROM public.items source WHERE tenant_id=${tenant} AND order_id=${sourceId}`;
  await seed`INSERT INTO public.events SELECT (jsonb_populate_record(NULL::public.events,replace(replace(replace(to_jsonb(event)::text,${sourceId},${legacy}),${oldItem},${newItem}),receipt.order_number,regexp_replace(receipt.order_number,'^A-[0-9]{4}-',${fixture.raw==='chrom'?'A-1900-':'A-1901-'}))::jsonb||jsonb_build_object('id',${eventId}::text,'client_event_id',${requestId}::text,'correlation_id',${requestId}::text))).* FROM public.events event JOIN private.order_intake_receipts receipt ON receipt.event_id=event.id WHERE receipt.tenant_id=${tenant} AND receipt.order_id=${sourceId}`;
  await seed`INSERT INTO private.order_intake_receipts SELECT (jsonb_populate_record(NULL::private.order_intake_receipts,to_jsonb(receipt)||jsonb_build_object('id',${randomUUID()}::text,'order_id',${legacy}::text,'order_number',regexp_replace(receipt.order_number,'^A-[0-9]{4}-',${fixture.raw==='chrom'?'A-1900-':'A-1901-'}),'event_id',${eventId}::text,'client_event_id',${requestId}::text,'correlation_id',${requestId}::text,'items_snapshot',jsonb_set(jsonb_set(receipt.items_snapshot,'{0,id}',to_jsonb(${newItem}::text)),'{0,surfaceRequested}',to_jsonb(${fixture.raw}::text))))).* FROM private.order_intake_receipts receipt WHERE receipt.tenant_id=${tenant} AND receipt.order_id=${sourceId}`;
 });
 const originals=async()=>({receipt:await sql`SELECT md5(to_jsonb(receipt)::text) AS hash FROM private.order_intake_receipts receipt WHERE tenant_id=${tenant} AND order_id=${legacy}`,event:await sql`SELECT md5(to_jsonb(event)::text) AS hash FROM public.events event WHERE tenant_id=${tenant} AND id=${eventId}`});
 const before=await originals();
 expect(await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${tenant},true)`;return tx`SELECT integrity_ok FROM private.v_order_intake_receipts_v1 WHERE tenant_id=${tenant} AND order_id=${legacy}`;})).toEqual([{integrity_ok:true}]);
 for(const orderId of [sourceId,legacy]){
  const card=await withSession(full,()=>getLiveOrderCardAction({orderId}));
  expect(card,JSON.stringify(card)).toMatchObject({code:'OK',data:{card:{items:[{surfaceRequested:'Verchromen'}]}}});
 }
 for(const orderIds of [[],[legacy],[sourceId,legacy]]){
  const root=await withSession(full,()=>getTodayOrderReadAction({orderIds}));
  expect(root,JSON.stringify(root)).toMatchObject({code:'OK'});if(root.code!=='OK')throw Error('TEST_ALIAS_REAL_TODAY_REQUIRED');
  expect(root.data.rows).toHaveLength(orderIds.length);
  expect(root.data.rows.map(row=>row.result.code)).toEqual(orderIds.map(()=>'OK'));
 }
 expect(await originals()).toEqual(before);
 const unknownHashes=async()=>({receipt:await sql`SELECT md5(to_jsonb(receipt)::text) AS hash FROM private.order_intake_receipts receipt WHERE tenant_id=${tenant} AND order_id=${unknown}`,event:await sql`SELECT md5(to_jsonb(event)::text) AS hash FROM public.events event WHERE tenant_id=${tenant} AND id=${unknownEvent}`});
 const unknownBefore=await unknownHashes();
 const unknownCard=await withSession(full,()=>getLiveOrderCardAction({orderId:unknown}));
 expect(unknownCard,JSON.stringify(unknownCard)).toMatchObject({code:'OK',data:{card:{items:[{id:unknownItem,surfaceRequested:'TEST_unbekannte_Oberflaeche',surfaceAssignmentRequired:'TEST_unbekannte_Oberflaeche'}]},nextActionRule:{hauptaktion:null,datenluecken:expect.arrayContaining(['ORDER_SURFACE_ASSIGNMENT_REQUIRED'])}}});
 const authorization=await withSession(full,()=>resolveAuthorization());if(!authorization.ok)throw Error('TEST_UNKNOWN_SURFACE_AUTH');
 const home=await withSession(full,()=>loadOfficeHome(authorization.data));
 expect(home.kind).toBe('data');if(home.kind!=='data')throw Error('TEST_UNKNOWN_SURFACE_HOME');
 const rows=home.dashboard.items.filter(item=>item.key==='source-order:'+unknown);
 expect(rows).toHaveLength(1);
 if(unknownCard.code!=='OK')throw Error('TEST_UNKNOWN_SURFACE_CARD');
 expect(rows[0]).toMatchObject({title:`Oberfläche „TEST_unbekannte_Oberflaeche“ in Auftrag ${unknownCard.data.card.orderNumber} zuordnen`,primaryActionLabel:'Oberfläche zuordnen',orderId:unknown,orderVersion:unknownCard.data.card.version,surfaceAssignments:[{itemId:unknownItem,rawValue:'TEST_unbekannte_Oberflaeche',proposals:[{key:'verchromen',label:'Als Verchromen zuordnen'}]}]});
 expect(await unknownHashes()).toEqual(unknownBefore);
 expect(await sql.begin(async tx=>{await tx`SELECT set_config('app.tenant_id',${tenant},true)`;return tx`SELECT integrity_ok,surface_mapping_readable FROM private.v_order_intake_receipts_v1 WHERE tenant_id=${tenant} AND order_id=${unknown}`;})).toEqual([{integrity_ok:false,surface_mapping_readable:true}]);
 const worker=await createFixture(['auftraege']),denied=await createFixture(['kunden']);
 const operationalCard=await withSession(worker,()=>getLiveOrderCardAction({orderId:unknown}));
 expect(operationalCard).toMatchObject({code:'OK',data:{card:{items:[{unitPriceCents:null,vatRateBasisPoints:null}]}}});
 if(operationalCard.code!=='OK')throw Error('TEST_SURFACE_WORKER_CARD');
 const correction={orderId:unknown,expectedVersion:operationalCard.data.card.version,clientEventId:randomUUID(),note:operationalCard.data.card.note,
  items:operationalCard.data.card.items.map(item=>({id:item.id,catalogServiceId:item.catalogServiceId,name:item.name,quantity:item.quantity,material:item.material,surface:'Verchromen',unit:item.unit,unitPriceCents:item.unitPriceCents,vatRateBasisPoints:item.vatRateBasisPoints}))};
 expect(await withSession(denied,()=>changeOrderContentAction(correction))).toMatchObject({code:'FORBIDDEN'});
 expect(await withSession(worker,()=>changeOrderContentAction({...correction,items:correction.items.map(item=>({...item,unitPriceCents:99999,vatRateBasisPoints:1900 as const}))}))).toMatchObject({code:'FORBIDDEN'});
 const fixed=await withSession(worker,()=>changeOrderContentAction(correction));
 expect(fixed,JSON.stringify(fixed)).toMatchObject({code:'OK',replayed:false,receipt:{actorId:worker.actorId}});
 expect(await withSession(worker,()=>changeOrderContentAction(JSON.parse(JSON.stringify(correction))))).toMatchObject({code:'OK',replayed:true});
 const fresh=await withSession(worker,()=>getLiveOrderCardAction({orderId:unknown}));
 expect(fresh,JSON.stringify(fresh)).toMatchObject({code:'OK',data:{card:{items:[{surfaceRequested:'Verchromen',unitPriceCents:null}]}}});
 if(fresh.code!=='OK')throw Error('TEST_SURFACE_FRESH_CARD');
 expect(fresh.data.card.items[0].surfaceAssignmentRequired).toBeUndefined();
 expect(await sql`SELECT round(preis_netto*100)::integer AS cents,vat_rate_basis_points FROM public.items WHERE tenant_id=${tenant} AND id=${unknownItem}`).toEqual([{cents:10000,vat_rate_basis_points:1900}]);
 expect(await unknownHashes()).toEqual(unknownBefore);
 expect(await sql`SELECT items_snapshot#>>'{0,surfaceRequested}' AS original FROM private.order_intake_receipts WHERE tenant_id=${tenant} AND order_id=${legacy}`).toEqual([{original:'chrom'}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${tenant} AND client_event_id=${input.clientEventId}::uuid AND event_type='ORDER_INTAKE_CREATED_V1'`).toEqual([{n:1}]);
});
