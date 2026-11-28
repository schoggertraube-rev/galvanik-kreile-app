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
import { liesEingangTagZeilenInTransaction } from '@/modules/eingang/server-public';
import { withPrivilegedTenantTransaction } from '@/lib/server/privilegedDb';

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

it('liest eine alte offene Quelle einmal je Kanal und lässt sie bei längerer Liegefrist offen ohne Tag-Zeile',async()=>{
 const id=randomUUID(),seit='2026-11-23T08:00:00+01:00';
 await sql`INSERT INTO public.intake_item(id,tenant_id,client_key,kanal,quelle,erstellt_von,wartet_seit)
  VALUES (${id},${tenant},${id},'datei','geraet',${full.actorId},${seit}::timestamptz)`;
 const jetzt=new Date('2026-11-24T09:00:00+01:00');
 const read=(liegefrist:number)=>withPrivilegedTenantTransaction({tenantId:tenant},tx=>
  liesEingangTagZeilenInTransaction(tx,tenant,jetzt,{liegefrist,nachfassfrist:2,schwelle:0.9,ruhe:new Set()}));
 expect((await read(24)).filter(zeile=>zeile.quelleId==='eingang.offen')).toMatchObject([{key:'eingang.offen:datei'}]);
 expect((await read(48)).filter(zeile=>zeile.quelleId==='eingang.offen')).toEqual([]);
});
