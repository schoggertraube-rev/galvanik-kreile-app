// @vitest-environment node
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, expect, it, vi } from 'vitest';

const tenant = vi.hoisted(() => 'TEST-ablauf-' + globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant', () => ({ KREILE_TENANT_SLUG: tenant }));

import { enableOutlookTestFixture, full, nativeFetch, sql, withSession } from '../../e2e/ablauf/replayHarness';
import { createCustomerAction } from '@/app/actions/customers.actions';
import { importOutlookMailAction } from '@/app/actions/communications.actions';
import { getIntakeAssignmentAction, finishIntakeFileAction, getIncomingInvoiceAction, prepareIntakeFileAction, saveIncomingInvoiceAction } from '@/app/actions/eingang.actions';
import { createAdminClient } from '@/lib/supabase/admin';
import {liesNachrichtenFuerTag} from '@/lib/server/todayProjection';
import {resolveAuthorization} from '@/lib/server/authorization';

async function createTestCustomer(name: string, email: string, phone: string) {
  const result = await createCustomerAction({
    clientEventId: randomUUID(), customerType: 'business', companyName: 'TEST ' + name,
    salutation: 'frau', firstName: 'TEST', lastName: name, phone, email,
    street: 'TEST Weg', houseNumber: '1', zipCode: '70176', city: 'Stuttgart',
    country: 'DE', paymentPreference: 'vorkasse', handoverPreference: 'shipping',
  });
  if (result.code !== 'OK') throw Error('TEST_I2_CUSTOMER_REQUIRED:'+result.code);
  return result.customer.id;
}

beforeAll(async () => {
  await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,street,zip,city,country,tax_id,ki_sicherheitsschwelle,
    material_aufschlag_prozent,lager_regelversion,eingang_verdacht_muster)
    VALUES (${randomUUID()},${tenant},'TEST Kreile','TEST Weg 1','70176','Stuttgart','DE','DE000000001',0.95,0,'TEST-I2',
      ${sql.json(['link','qr','bitte sofort überweisen'])})`;
});

it('ordnet anhand des Absenders zu und speichert fremde Mailtexte nur als gekennzeichneten Beleg', async () => {
  await enableOutlookTestFixture();
  const id = 'TEST-I2-' + randomUUID(), email = 'info@i2-' + randomUUID() + '.example.invalid';
  const message = {
    id, internetMessageId: '<'+id+'@example.invalid>', subject: 'TEST Eingang',
    from: { emailAddress: { address: email } }, receivedDateTime: new Date().toISOString(),
    body: { contentType: 'text', content: 'TEST Beleg. Bitte sofort überweisen. QR-Code: https://example.invalid/beleg' }, hasAttachments: false,
  };
  const original = 'Message-ID: '+message.internetMessageId+'\r\nSubject: '+message.subject+'\r\n\r\n'+message.body.content;
  const provider = vi.spyOn(globalThis,'fetch').mockImplementation((input,init) => {
    const url = new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    if (url.hostname==='login.microsoftonline.com') return Promise.resolve(Response.json({access_token:'TEST-I2-Graph-Token'.repeat(2)}));
    if (url.hostname!=='graph.microsoft.com') return nativeFetch(input,init);
    return Promise.resolve(url.pathname.endsWith('/$value') ? new Response(original)
      : Response.json(url.pathname.endsWith('/attachments') ? { value: [] } : message));
  });
  try {
    const kundeId = await withSession(full, () => createTestCustomer('Eingang GmbH', email, '+49 711 5550991'));
    const abruf = () => importOutlookMailAction(id,{deferDispatchReply:true});
    const result = await withSession(full,abruf,true);
    if (result.code!=='OK') throw Error('TEST_I2_IMPORT_REQUIRED:'+result.code);
    expect(await withSession(full,()=>getIntakeAssignmentAction({itemId:result.itemId,mode:'normal'})))
      .toMatchObject({code:'OK',view:{assignment:'automatisch',customer:{id:kundeId}}});
    expect(await withSession(full,abruf,true)).toMatchObject({code:'OK',itemId:result.itemId,replayed:true});
    expect(await sql`SELECT art,von,nachher->>'kandidaten' AS kandidaten FROM public.intake_event
      WHERE tenant_id=${tenant} AND item_id=${result.itemId} AND art IN('zugeordnet','erkannt') ORDER BY art`)
      .toEqual([{art:'erkannt',von:full.actorId,kandidaten:'ok'},{art:'zugeordnet',von:'system',kandidaten:null}]);
    expect(await sql`SELECT regel,grund,wert FROM public.intake_suggestion
      WHERE tenant_id=${tenant} AND item_id=${result.itemId} AND feld='text.verdacht' AND status='offen'`)
      .toEqual([{regel:'HC4',grund:'Verdächtiger Text',wert:{muster:['link','qr','bitte sofort ueberweisen']}}]);
  } finally {
    provider.mockRestore();
  }
});

it('behält ein strukturiertes Original und verwirft die eigene Firma als Lieferanten',async()=>{
 const xml=readFileSync('e2e/fixtures/e-rechnung/TEST_xrechnung_ubl.xml','utf8')
  .replace('DE 123456789','DE 000000001');
 const itemId=randomUUID(),fileId=randomUUID(),bytes=Buffer.from(xml),sha256=createHash('sha256').update(bytes).digest('hex');
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST_i2_eigene_firma.xml',mime:'application/xml',bytes:bytes.length,sha256}));
 if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I2_HC3_UPLOAD_GRANT');
 expect((await createAdminClient().storage.from(grant.upload.bucket)
  .uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,{contentType:'application/xml',upsert:false})).error).toBeNull();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
 expect(await sql`SELECT feld,status,regel FROM public.intake_suggestion WHERE tenant_id=${tenant} AND item_id=${itemId}
  AND feld IN ('rechnung.absender','kunde')`)
  .toEqual([{feld:'rechnung.absender',status:'verworfen',regel:'HC3'}]);
});

it('I2 E10 hält eine Rechnung mit unterschiedlicher gedruckter und eingebetteter Nummer offen zur Klärung',async()=>{
 const vat='DE900000071',nummer='TEST-E10-'+randomUUID().slice(0,8);
 const supplier=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',
  companyName:'TEST E10 Originalherkunft',vatId:vat,country:'DE'}));
 if(supplier.code!=='OK')throw Error('TEST_E10_SUPPLIER:'+supplier.code);
 const xml=readFileSync('e2e/fixtures/e-rechnung/TEST_xrechnung_ubl.xml','utf8').replace('DE 123456789',vat).replace('123456XX',nummer);
 const pdf=await PDFDocument.create(),page=pdf.addPage();
 page.drawText('Rechnungsnummer: '+nummer+'-DRUCK',{x:24,y:740,size:12});
 page.drawText('Brutto: 336,90 EUR',{x:24,y:715,size:12});
 await pdf.attach(Buffer.from(xml),'factur-x.xml',{mimeType:'application/xml'});
 const itemId=randomUUID(),fileId=randomUUID(),bytes=await pdf.save(),sha256=createHash('sha256').update(bytes).digest('hex');
 const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST_i2_rechnungswiderspruch.pdf',mime:'application/pdf',bytes:bytes.length,sha256}));
 if(grant.code!=='OK'||!grant.upload)throw Error('TEST_E10_UPLOAD_GRANT');
 const original=await createAdminClient().storage.from(grant.upload.bucket)
  .uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,{contentType:'application/pdf',upsert:false});
 expect(original.error).toBeNull();
 expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
 expect(await sql`SELECT grund,sicherheit FROM public.intake_suggestion WHERE tenant_id=${tenant} AND item_id=${itemId}
  AND file_id=${fileId} AND feld='rechnung.abgleich' AND status='offen'`)
  .toEqual([{grund:'PDF und XML widersprechen',sicherheit:'unsicher'}]);
 const input={itemId,fileId};
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:input.itemId,fileId:input.fileId}));
 if(read.code!=='OK')throw Error('TEST_E10_READ:'+read.code);
 const save={itemId:input.itemId,fileId:input.fileId,version:read.view.item.version,clientKey:randomUUID(),
  fields:{...read.view.fields,lieferantId:supplier.customer.id,faelligAm:'2026-12-01',iban:''},
  status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 const result=await withSession(full,()=>saveIncomingInvoiceAction(save));
 expect(result).toMatchObject({code:'OK',invoice:{zahlstatus:'unklar',unklar_grund:'PDF und XML widersprechen',aufgabe_id:expect.any(String)}});
 if(result.code!=='OK')throw Error('TEST_E10_SAVE:'+result.code);
 expect(await withSession(full,()=>saveIncomingInvoiceAction({...save})))
  .toMatchObject({code:'OK',replayed:true,invoice:{id:result.invoice.id,zahlstatus:'unklar'}});
});

it.each([
 {name:'andere Nummer',nummernEnde:'-DRUCK',brutto:'336,90',ziel:'offen',haelt:true,vat:'DE900000081'},
 {name:'anderer Bruttobetrag im Scan',nummernEnde:'',brutto:'337,90',ziel:'bezahlt',haelt:true,vat:'DE900000082',scan:true},
 {name:'übereinstimmende Angaben',nummernEnde:'',brutto:'336,90',ziel:'offen',haelt:false,vat:'DE900000083'},
 {name:'gedruckter Nummer und gescanntem Brutto ohne OCR-Rechnungskopf',nummernEnde:'',brutto:'338,90',
  ziel:'bezahlt',haelt:true,vat:'DE900000084',scan:true,hybrid:true,ohneOcrKopf:true},
 {name:'abweichendem Druckbetrag trotz passendem OCR-Betrag auf anderer Seite',nummernEnde:'',brutto:'336,90',
  druckBetrag:'338,90',ziel:'offen',haelt:true,vat:'DE900000085',scan:true,hybrid:true},
])('I2 E10 vergleicht getrennte gesicherte Originale bei $name',async(fall)=>{
 const nummer='TEST-I2-E10-'+randomUUID().slice(0,8);
 const supplier=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',
  companyName:'TEST E10 Getrennte Originale '+fall.vat,vatId:fall.vat,country:'DE'}));
 if(supplier.code!=='OK')throw Error('TEST_E10_SUPPLIER:'+supplier.code);
 const xml=Buffer.from(readFileSync('e2e/fixtures/e-rechnung/TEST_xrechnung_ubl.xml','utf8')
  .replace('DE 123456789',fall.vat).replace('123456XX',nummer));
 const pdf=await PDFDocument.create(),page=pdf.addPage();
 if(fall.scan){
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=','base64');
  if(fall.hybrid)page.drawText('Rechnungsnummer: '+nummer,{x:24,y:740,size:12});
  if(fall.druckBetrag)page.drawText('Brutto: '+fall.druckBetrag+' EUR',{x:24,y:710,size:12});
  const scanSeite=fall.hybrid?pdf.addPage():page;
  scanSeite.drawImage(await pdf.embedPng(png),{x:24,y:710,width:30,height:30});
 }else{
  page.drawText('Rechnungsnummer: '+nummer+fall.nummernEnde,{x:24,y:740,size:12});
  page.drawText('Brutto: '+fall.brutto+' EUR',{x:24,y:710,size:12});
 }
 const itemId=randomUUID(),pdfId=randomUUID(),xmlId=randomUUID();
 async function sichereOriginal(fileId:string,name:string,mime:string,bytes:Uint8Array){
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name,mime,bytes:bytes.length,sha256}));
  if(grant.code!=='OK'||!grant.upload)throw Error('TEST_E10_UPLOAD_GRANT');
  const original=await createAdminClient().storage.from(grant.upload.bucket)
   .uploadToSignedUrl(grant.upload.path,grant.upload.token,bytes,{contentType:mime,upsert:false});
  expect(original.error).toBeNull();
  expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
 }
 if(fall.scan){
  const [vorher]=await sql<{enabled:boolean}[]>`SELECT enabled FROM public.tenant_features WHERE tenant=${tenant} AND feature_id='E04'`;
  await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',true)
   ON CONFLICT (tenant,feature_id) DO UPDATE SET enabled=true`;
  const host='https://i2-test-scan.example.invalid';
  vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',host);
  vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-I2-Scan');
  const upstream=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
   const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
   if(url.origin!==host)return nativeFetch(input,init);
   const model=url.pathname.match(/documentModels\/([^:/]+)/u)?.[1];
   if(init?.method==='POST')return new Response(null,{status:202,headers:{'operation-location':
    host+'/documentintelligence/documentModels/'+model+'/analyzeResults/TEST-I2-Scan'}});
   const fundstellen=fall.hybrid?[{pageNumber:1},{pageNumber:2}]:[{pageNumber:1}];
   const werte=[...(fall.ohneOcrKopf?[]:[{key:'Rechnungsnummer',value:fall.hybrid?nummer+'-OCR':nummer,page:1}]),
    {key:'Netto',value:'300,00',page:1},{key:'Brutto',value:fall.brutto,page:fall.hybrid?2:1}];
   return Response.json({status:'succeeded',analyzeResult:{modelId:model,content:'Rechnung\nRechnungsnummer: '+nummer,
    pages:fundstellen,keyValuePairs:werte.map(({key,value,page})=>
     ({key:{content:key},value:{content:value,boundingRegions:[{pageNumber:page}]},confidence:0.99}))}});
  });
  try{
   await sichereOriginal(xmlId,'TEST_i2_getrennt.xml','application/xml',xml);
   await sichereOriginal(pdfId,'TEST_i2_getrennt.pdf','application/pdf',await pdf.save());
  }finally{
   upstream.mockRestore();
   vi.unstubAllEnvs();
   if(vorher)await sql`UPDATE public.tenant_features SET enabled=${vorher.enabled} WHERE tenant=${tenant} AND feature_id='E04'`;
   else await sql`DELETE FROM public.tenant_features WHERE tenant=${tenant} AND feature_id='E04'`;
  }
 }else{
  await sichereOriginal(pdfId,'TEST_i2_getrennt.pdf','application/pdf',await pdf.save());
  await sichereOriginal(xmlId,'TEST_i2_getrennt.xml','application/xml',xml);
 }
 const abgleiche=await sql`SELECT file_id,grund,sicherheit,wert->>'pdfId' AS pdf,wert->>'xmlId' AS xml
  FROM public.intake_suggestion WHERE tenant_id=${tenant} AND item_id=${itemId}
  AND feld='rechnung.abgleich' AND status='offen' ORDER BY file_id`;
 expect(abgleiche).toEqual(fall.haelt?[pdfId,xmlId].sort().map(file_id=>({file_id,grund:'PDF und XML widersprechen',
  sicherheit:'unsicher',pdf:pdfId,xml:xmlId})):[]);
 if(fall.hybrid)expect(await sql`SELECT fundstelle->>'page' AS seite,wert->'pdf' AS druckwerte
  FROM public.intake_suggestion WHERE tenant_id=${tenant} AND item_id=${itemId} AND file_id=${pdfId}
  AND feld='rechnung.abgleich' AND status='offen'`).toEqual([{seite:fall.druckBetrag?'1':'2',
   druckwerte:{nummer:nummer.toUpperCase(),bruttoCent:33890}}]);
 const read=await withSession(full,()=>getIncomingInvoiceAction({id:itemId,fileId:xmlId}));
 if(read.code!=='OK')throw Error('TEST_E10_READ:'+read.code);
 const save={itemId,fileId:xmlId,version:read.view.item.version,clientKey:randomUUID(),
  fields:{...read.view.fields,lieferantId:supplier.customer.id,faelligAm:'2026-12-01',iban:''},status:fall.ziel,
  paidDate:fall.ziel==='bezahlt'?'2026-11-27':null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null};
 const result=await withSession(full,()=>saveIncomingInvoiceAction(save));
 expect(result).toMatchObject({code:'OK',invoice:fall.haelt
  ?{zahlstatus:'unklar',unklar_grund:'PDF und XML widersprechen',aufgabe_id:expect.any(String),bezahlt_am:null}
  :{zahlstatus:'offen',unklar_grund:null}});
 if(result.code!=='OK')throw Error('TEST_E10_SAVE:'+result.code);
 expect(await withSession(full,()=>saveIncomingInvoiceAction({...save})))
  .toMatchObject({code:'OK',replayed:true,invoice:{id:result.invoice.id,zahlstatus:fall.haelt?'unklar':'offen'}});
});

it('schlägt denselben Beleg am jüngeren Eingang nach Foto und Mail vor',async()=>{
 await enableOutlookTestFixture();
 await sql`INSERT INTO public.tenant_features (tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
 const vat='DE900000077',nummer='TEST-I2-GLEICH-'+randomUUID().slice(0,8);
 const xml=Buffer.from(readFileSync('e2e/fixtures/e-rechnung/TEST_xrechnung_ubl.xml','utf8')
  .replace('DE 123456789',vat).replace('123456XX',nummer));
 const pdf=await PDFDocument.create();
 pdf.addPage().drawText('Rechnungsnummer: '+nummer);
 await pdf.attach(xml,'factur-x.xml',{mimeType:'application/xml'});
 const anhang=Buffer.from(await pdf.save());
 const foto=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=','base64');
 const itemId=randomUUID(),fileId=randomUUID(),sha256=createHash('sha256').update(foto).digest('hex');
 const graphId='TEST-I2-Paar-'+randomUUID(),internetMessageId='<'+graphId+'@example.invalid>';
 const mail={id:graphId,internetMessageId,subject:'TEST Rechnung',from:{emailAddress:{address:'beleg@example.invalid'}},
  receivedDateTime:'',body:{contentType:'text',content:'Rechnung im Anhang.'},hasAttachments:true};
 const mime='Message-ID: '+internetMessageId+'\r\nSubject: TEST Rechnung\r\n\r\nRechnung im Anhang.';
 const host='https://i2-dokumentlesen.example.invalid';
 const fields=[['Rechnungsnummer',nummer],['USt-ID',vat]];
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',host);
 vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-I2-Dokumentlesen');
 const upstream=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='login.microsoftonline.com')return Response.json({access_token:'TEST-I2-Graph-Token'.repeat(2)});
  if(url.hostname==='graph.microsoft.com'){
   if(url.pathname.endsWith('/$value'))return new Response(mime);
   if(url.pathname.endsWith('/attachments'))return Response.json({value:[{id:'TEST-PDF',name:'TEST-Rechnung.pdf',
    contentType:'application/pdf',size:anhang.length,contentBytes:anhang.toString('base64'),isInline:false}]});
   return Response.json(mail);
  }
  if(url.origin!==host)return nativeFetch(input,init);
  const model=url.pathname.match(/documentModels\/([^:/]+)/u)?.[1];
  if(init?.method==='POST')return new Response(null,{status:202,headers:{'operation-location':
   host+'/documentintelligence/documentModels/'+model+'/analyzeResults/TEST-I2'}});
  return Response.json({status:'succeeded',analyzeResult:{modelId:model,content:'Rechnung\nRechnungsnummer: '+nummer,
   pages:[{pageNumber:1}],keyValuePairs:fields.map(([key,value])=>({key:{content:key},value:{content:value},confidence:0.99}))}});
 });
 try {
  const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST_i2_rechnung.png',mime:'image/png',bytes:foto.length,sha256}));
  if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I2_FOTO_GRANT');
  expect((await createAdminClient().storage.from(grant.upload.bucket)
   .uploadToSignedUrl(grant.upload.path,grant.upload.token,foto,{contentType:'image/png',upsert:false})).error).toBeNull();
  expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
  expect(await sql`SELECT phase FROM public.intake_file WHERE tenant_id=${tenant} AND id=${fileId}`).toEqual([{phase:'eingang'}]);
  mail.receivedDateTime=new Date().toISOString();
  const importMail=()=>importOutlookMailAction(graphId,{deferDispatchReply:true});
  const result=await withSession(full,importMail,true);
  if(result.code!=='OK')throw Error('TEST_I2_PAAR_MAIL:'+result.code);
  expect(await withSession(full,importMail,true)).toMatchObject({code:'OK',itemId:result.itemId,replayed:true});
  expect(await sql`SELECT item_id,wert FROM public.intake_suggestion WHERE tenant_id=${tenant}
   AND feld='beleg.identitaet' AND status='offen' AND item_id IN (${itemId},${result.itemId})`)
   .toEqual([{item_id:result.itemId,wert:{itemId}}]);
 } finally {
  upstream.mockRestore();
  vi.unstubAllEnvs();
 }
});

it('liest eine alte offene Quelle einmal je Kanal und lässt sie bei längerer Liegefrist offen ohne Tag-Zeile',async()=>{
 const id=randomUUID(),seit='2026-11-23T08:00:00+01:00';
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,quelle,erstellt_von,wartet_seit)
  VALUES (${id},${tenant},${id},'datei','geraet',${full.actorId},${seit}::timestamptz)`;
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E01',true)
  ON CONFLICT (tenant,feature_id) DO UPDATE SET enabled=true`;
 const jetzt=new Date('2026-11-24T09:00:00+01:00');
 const session=await withSession(full,resolveAuthorization);
 if(!session.ok)throw Error('TEST_I2_TAG_AUTH');
 const read=async(liegefrist:number)=>{
  await sql`UPDATE public.company_settings SET eingang_liegefrist_arbeitsstunden=${liegefrist} WHERE tenant_id=${tenant}`;
  const result=await liesNachrichtenFuerTag(session.data,jetzt);
  if(result.code!=='OK'||result.tagFakten?.code!=='OK'||!result.tagFakten.fakten)throw Error('TEST_I2_TAG_FAKTEN');
  expect(result.messages.some(nachricht=>nachricht.id===id)).toBe(true);
  return result.tagFakten.fakten.filter(fakt=>fakt.art==='offen');
 };
 expect(await read(24)).toMatchObject([{kanal:'datei'}]);
 expect(await read(48)).toEqual([]);
});
