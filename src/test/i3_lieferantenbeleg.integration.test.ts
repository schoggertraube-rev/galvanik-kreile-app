// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {beforeAll,expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {createFixture,full,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {createCustomerAction} from '@/app/actions/customers.actions';
import {finishIntakeFileAction,getIncomingInvoiceAction,getIntakeTaskAction,prepareIntakeFileAction,saveIncomingInvoiceAction} from '@/app/actions/eingang.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {leseLieferantenbelegFuerLagerInTransaction,setzeLieferantAmEingangInTransaction} from '@/modules/eingang/server-public';

let lieferantId:string;

beforeAll(async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',false)
  ON CONFLICT (tenant,feature_id) DO UPDATE SET enabled=false`;
 const lieferant=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',
  companyName:'TEST I3 Lieferant',vatId:'DE900000093',country:'DE'}));
 if(lieferant.code!=='OK')throw Error('TEST_I3_LIEFERANT:'+lieferant.code);
 lieferantId=lieferant.customer.id;
});

it.each([0,1,200])('liest %i gespeicherte Lieferpositionen und den berichtigten Kopf in Originalreihenfolge',async(anzahl)=>{
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E04'`;
 const itemId=randomUUID(),fileId=randomUUID(),pdf=await PDFDocument.create();
 pdf.addPage().drawText('TEST Lieferschein '+anzahl);
 const bytes=await pdf.save(),sha256=createHash('sha256').update(bytes).digest('hex');
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,
  name:'TEST_I3_Lieferschein.pdf',mime:'application/pdf',bytes:bytes.length,sha256}));
 if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I3_UPLOAD');
 expect((await createAdminClient().storage.from(grant.upload.bucket)
  .uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,{contentType:'application/pdf',upsert:false})).error).toBeNull();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});

 // Isolierte TEST-Erkennungswerte zur Lesegrenze. Upload, Originalbeleg und Leser bleiben echt.
 await sql`UPDATE public.intake_item SET anliegen=ARRAY['lieferschein'],kunde_id=${lieferantId},zuordnung='hand'
  WHERE tenant_id=${tenant} AND id=${itemId}`;
 await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,sicherheit_wert,status)
  VALUES (${tenant},${itemId},${fileId},'beleg.nummer',to_jsonb('TEST zuerst'::text),'sicher',0.98,'offen'),
   (${tenant},${itemId},${fileId},'beleg.nummer',to_jsonb('TEST berichtigt'::text),'vorschlag',NULL,'uebernommen'),
   (${tenant},${itemId},${fileId},'beleg.datum',to_jsonb('2026-11-28'::text),'sicher',1,'offen')`;
 await sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,sicherheit_wert,status)
  SELECT ${tenant},${itemId}::uuid,${fileId}::uuid,'position',jsonb_build_object('positionKey','p'||nummer,
   'bezeichnung','TEST Teil '||nummer,'menge','2.5','ean','ungültig'),'sicher',0.98,'offen'
  FROM generate_series(${anzahl}::integer,1,-1) nummer`;
 await sql`UPDATE public.tenant_features SET enabled=true WHERE tenant=${tenant} AND feature_id='E04'`;

 const session=await withSession(full,resolveAuthorization);
 if(!session.ok)throw Error('TEST_I3_AUTH');
 const auth=session.data;
 const read=()=>withPrivilegedTenantTransaction(auth,tx=>leseLieferantenbelegFuerLagerInTransaction(tx,auth,itemId));
 const beleg=await read();
 expect(beleg).toMatchObject({itemId,fileId,dokumentSha256:sha256,belegart:'lieferschein',belegnummer:'TEST berichtigt',
  belegdatum:'2026-11-28',lieferantId,lieferantSicherheit:1,erkennungFertig:true,gueltig:true});
 expect(beleg?.positionen.map(position=>position.positionKey)).toEqual(Array.from({length:anzahl},(_,i)=>'p'+(i+1)));
 if(anzahl>0)expect(beleg?.positionen[0]).toMatchObject({bezeichnung:'TEST Teil 1',menge:'2.5',ean:null,sicherheit:0.98});
 if(anzahl===1){
  await sql`UPDATE public.intake_file SET erkennung_status='laeuft' WHERE tenant_id=${tenant} AND id=${fileId}`;
  await sql`UPDATE public.intake_item SET einsatz_aktion='kein_gv' WHERE tenant_id=${tenant} AND id=${itemId}`;
  expect(await read()).toMatchObject({fileId,erkennungFertig:false,gueltig:false});
  await sql`UPDATE public.intake_item SET anliegen=ARRAY['kontakt'] WHERE tenant_id=${tenant} AND id=${itemId}`;
  expect(await read()).toBeNull();
 }
});

it('ändert nur die ausgewählte Rechnung und lässt ihre Klärungsaufgabe offen',async()=>{
 await sql`UPDATE public.tenant_features SET enabled=false WHERE tenant=${tenant} AND feature_id='E04'`;
 const lieferanten=await Promise.all(['B','C'].map(kennung=>withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),
  customerType:'lieferant',companyName:'TEST I3 Rechnung '+kennung,country:'DE'}))));
 const [b,c]=lieferanten;
 if(b.code!=='OK'||c.code!=='OK')throw Error('TEST_I3_LIEFERANT_ANLAGE');
 const itemId=randomUUID(),nummer='TEST-I3-'+randomUUID().slice(0,8);
 const dateien:string[]=[];
 for(const bezeichnung of ['Hauptrechnung','Nebenrechnung']){
  const fileId=randomUUID(),pdf=await PDFDocument.create();
  pdf.addPage().drawText('TEST '+bezeichnung);
  const bytes=await pdf.save();
  const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:bezeichnung+'.pdf',mime:'application/pdf',
   bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
  if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I3_RECHNUNG_UPLOAD');
  expect((await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,
   {contentType:'application/pdf',upsert:false})).error).toBeNull();
  expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
  dateien.push(fileId);
 }
 async function rechnungSpeichern(fileId:string,supplierId:string,unklar:boolean){
  const read=await withSession(full,()=>getIncomingInvoiceAction({id:itemId,fileId}));
  if(read.code!=='OK')throw Error('TEST_I3_RECHNUNG_LESEN:'+read.code);
  const saved=await withSession(full,()=>saveIncomingInvoiceAction({itemId,fileId,version:read.view.item.version,clientKey:randomUUID(),
   fields:{lieferantId:supplierId,nummer,datum:'2026-11-27',netto:'10,00',ust:'0,00',brutto:'10,00',faelligAm:'2026-12-15',iban:'',ibanGeprueft:false},
   status:unklar?'unklar':'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:unklar?'TEST Beleg unklar':null}));
  if(saved.code!=='OK')throw Error('TEST_I3_RECHNUNG_SPEICHERN:'+saved.code);
  return saved.invoice;
 }
 const haupt=await rechnungSpeichern(dateien[0],lieferantId,false);
 const neben=await rechnungSpeichern(dateien[1],b.customer.id,true);
 const taskId=neben.aufgabe_id;
 if(!taskId)throw Error('TEST_I3_KLAERAUFGABE_FEHLT');
 const session=await withSession(full,resolveAuthorization);
 if(!session.ok)throw Error('TEST_I3_RECHNUNG_AUTH');
 const auth=session.data;
 const setze=(supplierId:string,rechnungId?:string)=>withPrivilegedTenantTransaction(auth,
  tx=>setzeLieferantAmEingangInTransaction(tx,auth,itemId,supplierId,rechnungId));
 await expect(setze(c.customer.id)).rejects.toThrow('CONFLICT');
 await expect(setze(c.customer.id,randomUUID())).rejects.toThrow('CONFLICT');
 await expect(setze(b.customer.id,haupt.id)).rejects.toThrow('CONFLICT');
 await setze(c.customer.id,neben.id);
 await setze(c.customer.id,neben.id);
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:neben.id}))).toMatchObject({code:'OK',view:{invoice:{
  lieferant_id:c.customer.id,version:neben.version+1,zahlstatus:'unklar',unklar_grund:'TEST Beleg unklar',aufgabe_id:neben.aufgabe_id}}});
 expect(await withSession(full,()=>getIntakeTaskAction({taskId}))).toMatchObject({code:'OK',task:{status:'offen'}});
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:haupt.id}))).toMatchObject({code:'OK',view:{invoice:{
  lieferant_id:lieferantId,version:haupt.version,zahlstatus:'offen'}}});
 expect(await sql`SELECT kunde_id,vorgang_id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${itemId}::uuid`)
  .toEqual([{kunde_id:lieferantId,vorgang_id:haupt.id}]);
 expect(await sql`SELECT von,nachher->>'lieferantId' AS lieferant FROM public.intake_event WHERE tenant_id=${tenant}
  AND item_id=${itemId}::uuid AND art='zugeordnet' AND nachher->>'rechnungId'=${neben.id}`)
  .toEqual([{von:full.actorId,lieferant:c.customer.id}]);
 const leser=await withSession(await createFixture([],'readonly'),resolveAuthorization);
 if(!leser.ok)throw Error('TEST_I3_NUR_LESER');
 const leserRechte=leser.data;
 await expect(withPrivilegedTenantTransaction(leserRechte,tx=>setzeLieferantAmEingangInTransaction(tx,leserRechte,itemId,
  b.customer.id,neben.id))).rejects.toThrow('FORBIDDEN');
 await setze(b.customer.id,haupt.id);
 expect(await withSession(full,()=>getIncomingInvoiceAction({id:haupt.id}))).toMatchObject({code:'OK',view:{invoice:{
  lieferant_id:b.customer.id,version:haupt.version+1,zahlstatus:'offen'}}});
 expect(await sql`SELECT kunde_id,vorgang_id FROM public.intake_item WHERE tenant_id=${tenant} AND id=${itemId}::uuid`)
  .toEqual([{kunde_id:b.customer.id,vorgang_id:haupt.id}]);
});
