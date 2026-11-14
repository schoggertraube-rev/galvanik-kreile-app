// @vitest-environment node
import {vi,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));
import {KREILE_TENANT_SLUG} from '@/lib/tenant';
import {sql,full,withSession,createFixture} from '../../../e2e/ablauf/replayHarness';
import {readyInvoiceOrder,readyOrderForInvoice,manualTrackingFixture} from '../../../e2e/ablauf/orderFixture';
const DATABASE_URL=process.env.DATABASE_URL,EXPECTED_DATABASE_URL=process.env.H18_EXPECTED_DATABASE_URL;
if(!DATABASE_URL||DATABASE_URL!==EXPECTED_DATABASE_URL||new URL(DATABASE_URL).hostname!=='127.0.0.1')throw Error('MANUAL_SHIPPING_LOOPBACK_REPLAY_REQUIRED');

it('S10 group confirmation reads zero, one and two real members with the same current version from either order',async()=>{
 // Form the real group before invoice issuance, as S09 requires. A fee line
 // remains an issued shipping original even when its configured amount is zero.
 const a=await readyOrderForInvoice('TEST S10 Gruppe A','shipping');
 const b=await readyOrderForInvoice('TEST S10 Gruppe B','shipping',a.customerId);
 const {getManualShippingAction,saveManualTrackingAction}=await import('@/app/actions/orders.actions');
 const empty=await withSession(full,()=>getManualShippingAction({orderId:a.orderId}));
 expect(empty).toMatchObject({code:'OK',data:{shipments:[],shipmentGroups:[]}});
 const single=await manualTrackingFixture(a.orderId);
 const one=await withSession(full,()=>getManualShippingAction({orderId:a.orderId}));
 expect(one).toMatchObject({code:'OK',data:{shipmentGroups:[{id:single.shipmentId,members:[{shipmentId:single.shipmentId,orderId:a.orderId,orderVersion:a.version}]}]}});
 const grouped=await withSession(full,()=>saveManualTrackingAction({orderId:a.orderId,shipmentId:single.shipmentId,expectedUpdatedAt:single.updatedAt,trackingNumber:single.trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID(),withOrder:{orderId:b.orderId,shipmentId:null,expectedUpdatedAt:null}}));
 expect(grouped,JSON.stringify(grouped)).toMatchObject({code:'OK'});if(grouped.code!=='OK')throw Error('TEST_S10_GROUP_CREATE');
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const login=await createFixture(['auftraege'],'werkstatt');
 const readA=await withSession(login,()=>getManualShippingAction({orderId:a.orderId})),readB=await withSession(login,()=>getManualShippingAction({orderId:b.orderId}));
 if(readA.code!=='OK'||readB.code!=='OK')throw Error('TEST_S10_GROUP_READ');
 expect(readA.data.shipments).toHaveLength(1);expect(readB.data.shipments).toHaveLength(1);
 expect(readA.data.shipmentGroups).toEqual(readB.data.shipmentGroups);
 expect(readA.data.shipmentGroups).toHaveLength(1);
 const group=readA.data.shipmentGroups[0];
 expect(group.id).toBe(grouped.receipt.sendungId);expect(group.version).toMatch(/^[a-f0-9]{64}$/);
 expect(group.members.map(row=>row.orderId).sort()).toEqual([a.orderId,b.orderId].sort());
 expect(JSON.stringify(group)).not.toMatch(/Cents|netto|invoice|payment/);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
 const denied=await createFixture(['kunden']);
 expect(await withSession(denied,()=>getManualShippingAction({orderId:b.orderId}))).toMatchObject({code:'FORBIDDEN'});
 const member=readB.data.shipments[0];
 expect(await withSession(login,()=>saveManualTrackingAction({orderId:b.orderId,shipmentId:member.id,expectedUpdatedAt:member.updatedAt,trackingNumber:single.trackingNumber,allowFormatMismatch:false,reason:null,clientEventId:randomUUID()}))).toMatchObject({code:'OK'});
 const changed=await withSession(login,()=>getManualShippingAction({orderId:a.orderId}));if(changed.code!=='OK')throw Error('TEST_S10_GROUP_RELOAD');
 expect(changed.data.shipmentGroups[0].version).not.toBe(group.version);
 expect(group.members.find(row=>row.orderId===b.orderId)?.trackingNumber).toBe(null);
 expect(changed.data.shipmentGroups[0].members.find(row=>row.orderId===b.orderId)?.trackingNumber).toBe(single.trackingNumber);
});

it('A10-1/3 a label without a secured tracking receipt cannot release the actual goods',async()=>{
 const order=await readyInvoiceOrder('TEST S10 Etikett ist keine Übergabe','shipping');
 // Explicit synthetic provider-label boundary; no purchase or carrier handover.
 const shipmentId=randomUUID();
 await sql`INSERT INTO public.shipments(id,tenant_id,order_id,carrier,status,label_url) VALUES(${shipmentId}::uuid,${KREILE_TENANT_SLUG},${order.orderId},'TEST S10 Paket','created','https://example.invalid/TEST-label.pdf')`;
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const input={orderId:order.orderId,mode:'versand' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`;
 expect(await withSession(full,()=>recordGoodsOutAction(input))).toMatchObject({code:'VALIDATION_ERROR',message:'Sendungsnummer fehlt – trag sie ein'});
 expect(await withSession(full,()=>recordGoodsOutAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'VALIDATION_ERROR'});
 // A number on a synthetic provider row alone still is not the secured
 // original from the existing manual tracking writer.
 await sql`UPDATE public.shipments SET tracking_number='TEST-unproven-label-number' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${shipmentId}::uuid`;
 expect(await withSession(full,()=>recordGoodsOutAction({...input,clientEventId:randomUUID()}))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version}}});
 expect(await sql`SELECT status,shipped_at FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${shipmentId}::uuid`).toEqual([{status:'created',shipped_at:null}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual(before);
});

it('A10-3b empty tracking format accepts a real nonempty number and retains the original across reload and actor-bound retry',async()=>{
 const order=await readyInvoiceOrder('TEST S10 freies Nummernformat','shipping');
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const settings=await withSession(full,()=>readShippingSettingsAction());
 if(settings.code!=='OK')throw Error('TEST_S10_SETTINGS:'+settings.code);
 expect(await withSession(full,()=>saveShippingSettingsAction({service:'TEST S10 Paket',numberPattern:'',numberHint:'',trackingUrl:null,expectedUpdatedAt:settings.settings.updatedAt}))).toMatchObject({code:'OK'});
 const {getManualShippingAction,saveManualTrackingAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const login=await createFixture(['auftraege'],'werkstatt');
 const input={orderId:order.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'TEST / frei 42',allowFormatMismatch:false,reason:null,clientEventId:randomUUID()};
 const saved=await withSession(login,()=>saveManualTrackingAction(input));
 expect(saved).toMatchObject({code:'OK',replayed:false,receipt:{trackingNumber:input.trackingNumber,actorId:login.actorId,formatOverride:false}});
 if(saved.code!=='OK')throw Error('TEST_S10_TRACKING:'+saved.code);
 expect(await withSession(login,()=>getManualShippingAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{shipments:[{id:input.shipmentId,trackingNumber:input.trackingNumber,status:'created'}]}});
 expect(await withSession(login,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version}}});
 expect(await withSession(login,()=>saveManualTrackingAction(JSON.parse(JSON.stringify(input))))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
 const other=await createFixture(['auftraege'],'werkstatt');
 expect(await withSession(other,()=>saveManualTrackingAction(structuredClone(input)))).toMatchObject({code:'CONFLICT',reason:'TRACKING_KEY_CONFLICT'});
 const empty={...input,shipmentId:randomUUID(),trackingNumber:'',clientEventId:randomUUID()};
 expect(await withSession(login,()=>saveManualTrackingAction(empty))).toMatchObject({code:'VALIDATION_ERROR'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND order_id=${order.orderId}`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid AND event_type='SHIPMENT_MANUAL_TRACKING_SET_V1'`).toEqual([{n:1}]);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${empty.clientEventId}::uuid`).toEqual([{n:0}]);
});

it('V13–V16 actual manual tracking keeps shipment, actor and history across reads/retries; rejected changes write nothing',async()=>{
 const order=await readyInvoiceOrder('V13-Manuell','shipping');
 const {readShippingSettingsAction,saveShippingSettingsAction}=await import('@/app/actions/settings.actions');
 const settings=await withSession(full,()=>readShippingSettingsAction());if(settings.code!=='OK')throw Error('SHIPPING_SETTINGS:'+settings.code);
 expect(await withSession(full,()=>saveShippingSettingsAction({service:'TEST Parcel',numberPattern:'^TEST-[0-9]{4}$',numberHint:'TEST und vier Ziffern',trackingUrl:'https://tracking.example.invalid/{nr}',expectedUpdatedAt:settings.settings.updatedAt}))).toMatchObject({code:'OK'});
 const {getManualShippingAction,saveManualTrackingAction,getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const before=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const read=await withSession(full,()=>getManualShippingAction({orderId:order.orderId}));
 expect(read).toMatchObject({code:'OK',data:{fields:{zipCode:'70176',city:'Stuttgart'},missing:[],releaseAllowed:true,shipments:[]}});
 if(read.code!=='OK')throw Error('SHIPPING_READ:'+read.code);
 expect(read.data.copyText).toContain('PLZ: 70176');
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(before);
 const operational=await createFixture(['auftraege'],'werkstatt');
 const operationalRead=await withSession(operational,()=>getManualShippingAction({orderId:order.orderId}));
 expect(operationalRead).toMatchObject({code:'OK',data:{releaseAllowed:true}});
 expect(JSON.stringify(operationalRead)).not.toMatch(/Amount|Cents|invoiceNumber|paymentStatus/);
 const input={orderId:order.orderId,shipmentId:randomUUID(),expectedUpdatedAt:null,trackingNumber:'TEST-0001',allowFormatMismatch:false,reason:null,clientEventId:randomUUID()};
 const saved=await withSession(full,()=>saveManualTrackingAction(input));
 expect(saved).toMatchObject({code:'OK',replayed:false,receipt:{shipmentId:input.shipmentId,trackingNumber:input.trackingNumber,actorId:full.actorId,formatOverride:false}});
 if(saved.code!=='OK')throw Error('SHIPPING_SAVE:'+saved.code);
 expect(await sql`SELECT carrier,tracking_number,status,label_url,shipped_at,delivered_at FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.shipmentId}::uuid`).toEqual([{carrier:'TEST Parcel',tracking_number:'TEST-0001',status:'created',label_url:null,shipped_at:null,delivered_at:null}]);
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{station:'fertig',version:order.version},manualShipping:{code:'OK',data:{shipments:[{id:input.shipmentId,trackingUrl:'https://tracking.example.invalid/TEST-0001'}]}}}});
 expect(await withSession(full,()=>saveManualTrackingAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true,receipt:{eventId:saved.receipt.eventId}});
 expect(await sql`SELECT user_id::text FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${input.clientEventId}::uuid`).toEqual([{user_id:full.actorId}]);
 const invalid={...input,shipmentId:randomUUID(),trackingNumber:'BAD',clientEventId:randomUUID()};
 expect(await withSession(full,()=>saveManualTrackingAction(invalid))).toMatchObject({code:'VALIDATION_ERROR',reason:'TRACKING_FORMAT_CONFIRMATION_REQUIRED'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${invalid.shipmentId}::uuid`).toEqual([{n:0}]);
 expect(await withSession(full,()=>saveManualTrackingAction({...invalid,allowFormatMismatch:true}))).toMatchObject({code:'OK',receipt:{formatOverride:true}});
 const duplicate={...input,shipmentId:randomUUID(),clientEventId:randomUUID()};
 expect(await withSession(full,()=>saveManualTrackingAction(duplicate))).toMatchObject({code:'CONFLICT',reason:'TRACKING_ALREADY_ASSIGNED',shipmentId:input.shipmentId});
 const correction={...input,expectedUpdatedAt:saved.receipt.updatedAt,trackingNumber:'TEST-0002',clientEventId:randomUUID()};
 expect(await withSession(full,()=>saveManualTrackingAction(correction))).toMatchObject({code:'VALIDATION_ERROR',reason:'TRACKING_CHANGE_REASON_REQUIRED'});
 const changed=await withSession(full,()=>saveManualTrackingAction({...correction,reason:'TEST Nummer vertippt'}));
 expect(changed).toMatchObject({code:'OK'});if(changed.code!=='OK')throw Error('SHIPPING_CHANGE:'+changed.code);
 expect(await withSession(full,()=>getManualShippingAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{shipments:expect.arrayContaining([expect.objectContaining({id:input.shipmentId,trackingNumber:'TEST-0002'})])}});
 expect(await withSession(full,()=>saveManualTrackingAction({...correction,reason:'TEST veralteter Stand',clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT',reason:'SHIPMENT_CHANGED'});
 const reader=await createFixture(['kunden']);
 const denied={...input,shipmentId:randomUUID(),clientEventId:randomUUID()};
 expect(await withSession(reader,()=>saveManualTrackingAction(denied))).toMatchObject({code:'FORBIDDEN'});
 for(const key of [duplicate.clientEventId,denied.clientEventId])expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND client_event_id=${key}::uuid`).toEqual([{n:0}]);
 expect(await sql`SELECT payload->>'before' AS before,payload->>'reason' AS reason FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${changed.receipt.eventId}`).toEqual([{before:'TEST-0001',reason:'TEST Nummer vertippt'}]);
 // Isolated mutable TEST master-data damage: no production or immutable history is changed.
 await sql`UPDATE public.customers SET street=NULL WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const missingAddress={...input,shipmentId:randomUUID(),trackingNumber:'TEST-0003',clientEventId:randomUUID()};
 expect(await withSession(full,()=>saveManualTrackingAction(missingAddress))).toMatchObject({code:'VALIDATION_ERROR',reason:'SHIPPING_ADDRESS_INCOMPLETE'});
 expect(await sql`SELECT count(*)::integer AS n FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${missingAddress.shipmentId}::uuid`).toEqual([{n:0}]);
 await sql`UPDATE public.customers SET street='TEST Weg' WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${order.customerId}`;
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const handover={orderId:order.orderId,mode:'versand' as const,expectedVersion:order.version,clientEventId:randomUUID()};
 const handedOver=await withSession(full,()=>recordGoodsOutAction(handover));
 expect(handedOver).toMatchObject({code:'OK'});if(handedOver.code!=='OK')throw Error('MANUAL_HANDOVER:'+handedOver.code);
 expect(await sql`SELECT status,shipped_at IS NOT NULL AS handed_over,delivered_at FROM public.shipments WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${input.shipmentId}::uuid`).toEqual([{status:'shipped',handed_over:true,delivered_at:null}]);
 expect(await sql`SELECT user_id::text,payload->>'goodsOutEventId' AS physical_receipt FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='SHIPMENT_HANDED_OVER_V1' AND payload->>'shipmentId'=${input.shipmentId}`).toEqual([{user_id:full.actorId,physical_receipt:handedOver.receipt.eventId}]);
 expect(await withSession(full,()=>getManualShippingAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{shipments:expect.arrayContaining([expect.objectContaining({id:input.shipmentId,status:'shipped'})])}});
 // A real handed-over shipment is not a delivered order; no delivery receipt exists.
 expect(await withSession(full,()=>getLiveOrderCardAction({orderId:order.orderId}))).toMatchObject({code:'OK',data:{card:{handoverMode:'shipping'},nextActionRule:{code:'OK',hauptaktion:null,datenluecken:expect.arrayContaining(['returning'])}}});
 expect(await withSession(full,()=>recordGoodsOutAction(structuredClone(handover)))).toMatchObject({code:'OK',replayed:true});
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG} AND event_type='SHIPMENT_HANDED_OVER_V1' AND payload->>'shipmentId'=${input.shipmentId}`).toEqual([{n:1}]);
 expect(await withSession(full,()=>saveManualTrackingAction({...correction,expectedUpdatedAt:changed.receipt.updatedAt,reason:'TEST zu spät',clientEventId:randomUUID()}))).toMatchObject({code:'CONFLICT',reason:'SHIPPING_RELEASE_BLOCKED'});
});

it('reads the physical pickup first look from the same real card without money or unrelated blockers',async()=>{
 const order=await readyInvoiceOrder('TEST U2 Abgeholt','pickup');
 const {recordGoodsOutAction}=await import('@/app/actions/goodsOut.actions');
 const {getLiveOrderCardAction}=await import('@/app/actions/orders.actions');
 const handed=await withSession(full,()=>recordGoodsOutAction({orderId:order.orderId,mode:'abholung',expectedVersion:order.version,clientEventId:randomUUID()}));
 expect(handed.code).toBe('OK');
 const login=await createFixture(['auftraege'],'werkstatt');
 const count=await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`;
 const read=await withSession(login,()=>getLiveOrderCardAction({orderId:order.orderId}));
 expect(read).toMatchObject({code:'OK',data:{nextActionRule:{code:'OK',zustand:'closed',hauptaktion:null,weitere:[],gesperrt:[]}}});
 if(read.code!=='OK'||read.data.nextActionRule?.code!=='OK')throw Error('TEST_PICKUP_FIRST_LOOK');
 expect(read.data.nextActionRule.erstblick.map(row=>row.key)).toEqual(['auftrag.lage','auftrag.termin','auftrag.teile','auftrag.hauptaktion']);
 expect(read.data.nextActionRule.source.version).toBe(read.data.card.version);
 expect(read.data.nextActionRule.quelle.erwartungSha256).toMatch(/^[a-f0-9]{64}$/);
 expect(JSON.stringify(read.data.nextActionRule)).not.toMatch(/netto|Cents|unitPrice|vatRate/);
 expect(await sql`SELECT count(*)::integer AS n FROM public.events WHERE tenant_id=${KREILE_TENANT_SLUG}`).toEqual(count);
});

it('R15 active intake exposes the same versioned first look and existing start command without money',async()=>{
 const {customerFixture,intakeOrderFixture}=await import('../../../e2e/ablauf/orderFixture');
 const customer=await customerFixture('TEST R15 active');
 const created=await intakeOrderFixture('TEST R15 active',customer);
 const {getLiveOrderCardAction,transitionWareneingangToGalvanikAction}=await import('@/app/actions/orders.actions');
 const login=await createFixture(['auftraege'],'werkstatt');
 const read=await withSession(login,()=>getLiveOrderCardAction({orderId:created.receipt.orderId}));
 console.info('TEST_R15_SOURCE',JSON.stringify(read.code==='OK'?read.data.nextActionRule:read));
 expect(read).toMatchObject({code:'OK',data:{nextActionRule:{code:'OK',zustand:'received',hauptaktion:{elementId:'order.start',befehl:{funktion:'transitionWareneingangToGalvanikAction',argumente:{orderId:created.receipt.orderId,expectedVersion:1}}},datenluecken:expect.arrayContaining(['workProblem','deliveryRequest','termUpdatePending','workUpdatePending','extraPending'])}}});
 if(read.code!=='OK'||read.data.nextActionRule?.code!=='OK'||!read.data.nextActionRule.hauptaktion)throw Error('TEST_ACTIVE_U2_REQUIRED');
 const rule=read.data.nextActionRule;
 expect(rule.source.version).toBe(read.data.card.version);expect(rule.erstblick.length).toBeLessThanOrEqual(5);
 expect(JSON.stringify(rule)).not.toMatch(/Cents|unitPrice|netto|vatRate/);
 if(!rule.hauptaktion||typeof rule.hauptaktion!=='object'||!('befehl'in rule.hauptaktion))throw Error('TEST_COMMAND_REQUIRED');
 const args=JSON.parse(JSON.stringify(rule.hauptaktion.befehl.argumente));
 const input={...args,clientEventId:randomUUID()};
 expect(await withSession(login,()=>transitionWareneingangToGalvanikAction(input))).toMatchObject({code:'OK'});
 expect(await withSession(login,()=>transitionWareneingangToGalvanikAction(structuredClone(input)))).toMatchObject({code:'OK',replayed:true});
 const photoRead=await withSession(login,()=>getLiveOrderCardAction({orderId:created.receipt.orderId}));
 console.info('TEST_R15_PHOTO_SOURCE',JSON.stringify(photoRead.code==='OK'?photoRead.data.nextActionRule:photoRead));
 expect(photoRead).toMatchObject({code:'OK',data:{card:{station:'galvanik'},nextActionRule:{code:'OK',zustand:'photo',hauptaktion:{elementId:'order.photo',befehl:{funktion:'reserveGalvanikHandoffAttachmentAction',argumente:{itemId:created.receipt.items[0].id}}}}}});
 const {storeItemPhoto}=await import('../../../e2e/ablauf/photoFixture');
 await storeItemPhoto(created.receipt.orderId,created.receipt.items[0].id);
 const partsRead=await withSession(login,()=>getLiveOrderCardAction({orderId:created.receipt.orderId}));
 console.info('TEST_R15_PARTS_SOURCE',JSON.stringify(partsRead.code==='OK'?partsRead.data.nextActionRule:partsRead));
 expect(partsRead).toMatchObject({code:'OK',data:{nextActionRule:{code:'OK',zustand:'work',hauptaktion:{elementId:'order.parts',ziel:{tab:'parts'},befehl:{funktion:'getLiveOrderCardAction'}}}}});
 if(partsRead.code!=='OK')throw Error('TEST_PARTS_READ');
 const {setOrderItemFinishedAction}=await import('@/app/actions/orders.actions');
 expect(await withSession(login,()=>setOrderItemFinishedAction({orderId:created.receipt.orderId,itemId:created.receipt.items[0].id,expectedVersion:partsRead.data.card.version,clientEventId:randomUUID(),finished:true}))).toMatchObject({code:'OK'});
 const finishRead=await withSession(login,()=>getLiveOrderCardAction({orderId:created.receipt.orderId}));
 console.info('TEST_R15_FINISH_SOURCE',JSON.stringify(finishRead.code==='OK'?finishRead.data.nextActionRule:finishRead));
 expect(finishRead).toMatchObject({code:'OK',data:{nextActionRule:{code:'OK',zustand:'finish',hauptaktion:{elementId:'order.finish',befehl:{funktion:'freezeOrderAction'}}}}});
 expect(JSON.stringify(finishRead.code==='OK'?finishRead.data.nextActionRule:{})).not.toMatch(/Cents|unitPrice|netto|vatRate/);
});
