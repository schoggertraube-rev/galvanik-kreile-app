// @vitest-environment node
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {beforeAll,expect,it,vi} from 'vitest';

const tenant=vi.hoisted(()=>'TEST-ablauf-'+globalThis.crypto.randomUUID());
vi.mock('@/lib/tenant',()=>({KREILE_TENANT_SLUG:tenant}));

import {full,nativeFetch,sql,withSession} from '../../e2e/ablauf/replayHarness';
import {finishIntakeFileAction,getIntakeCaptureAction,prepareIntakeFileAction,saveIncomingInvoiceAction,selectIntakeConcernAction} from '@/app/actions/eingang.actions';
import {createCustomerAction} from '@/app/actions/customers.actions';
import {resolveAuthorization} from '@/lib/server/authorization';
import {withPrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {createAdminClient} from '@/lib/supabase/admin';
import {leseLieferantenbelegFuerLagerInTransaction} from '@/modules/eingang/server-public';

beforeAll(async()=>{
 await sql`INSERT INTO public.tenant_features(tenant,feature_id,enabled) VALUES (${tenant},'E04',true)`;
 await sql`INSERT INTO public.company_settings(id,tenant_id,company_name,material_aufschlag_prozent,
  lager_regelversion,ki_sicherheitsschwelle) VALUES (${randomUUID()},${tenant},'TEST H8',0,'TEST-H8',0.95)`;
});

async function sichereErkanntesOriginal(name:string,seiten:number,roh:string){
 const host='https://i3-h8.example.invalid';
 vi.stubEnv('AZURE_DOCINTEL_ENDPOINT',host);
 vi.stubEnv('AZURE_DOCINTEL_KEY','TEST-H8-Anbieter');
 const provider=vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.origin!==host)return nativeFetch(input,init);
  return init?.method==='POST'?new Response(null,{status:202,headers:{'operation-location':
   host+'/documentintelligence/documentModels/prebuilt-layout/analyzeResults/TEST-H8'}}):new Response(roh);
 });
 try{
  const itemId=randomUUID(),fileId=randomUUID(),pdf=await PDFDocument.create();
  for(let seite=1;seite<=seiten;seite++)pdf.addPage().drawText('TEST '+name+' '+seite);
  const bytes=await pdf.save(),sha256=createHash('sha256').update(bytes).digest('hex');
  const grant=await withSession(full,()=>prepareIntakeFileAction({itemId,fileId,name:'TEST_'+name+'.pdf',
   mime:'application/pdf',bytes:bytes.length,sha256}));
  if(grant.code!=='OK'||!grant.upload)throw Error('TEST_I3_H8_UPLOAD');
  const original=await createAdminClient().storage.from(grant.upload.bucket).uploadToSignedUrl(grant.upload.path,grant.upload.token,
   bytes,{contentType:'application/pdf',upsert:false});
  expect(original.error).toBeNull();
  expect(await withSession(full,()=>finishIntakeFileAction(fileId),true)).toMatchObject({code:'OK'});
  const session=await withSession(full,resolveAuthorization);
  if(!session.ok)throw Error('TEST_I3_H8_AUTH');
  const auth=session.data;
  return {itemId,fileId,sha256,lese:(rechnungId?:string)=>withPrivilegedTenantTransaction(auth,
    tx=>leseLieferantenbelegFuerLagerInTransaction(tx,auth,itemId,rechnungId))};
 }finally{
  provider.mockRestore();
  vi.unstubAllEnvs();
 }
}

it.each([
 {name:'lieferschein',belegart:'lieferschein',belegnummer:'TEST-LS-03',einzelpreis:null},
 {name:'lieferantenrechnung',belegart:'lieferantenrechnung',belegnummer:'TEST-RE-03',einzelpreis:'24.80'},
])('liest den gesicherten TEST-$name bis zum Lagerport',async({name,belegart,belegnummer,einzelpreis})=>{
 const roh=readFileSync('e2e/fixtures/erkennung/TEST_'+name+'.json','utf8');
 const {itemId,fileId,sha256,lese}=await sichereErkanntesOriginal(name,1,roh);
 expect(await lese()).toMatchObject({itemId,fileId,dokumentSha256:sha256,belegart,belegnummer,
  bezug:{bestellNummer:'TEST-BESTELLUNG-03',lieferscheinNummern:['TEST-LS-03']},
  positionen:[{positionKey:'p1',lieferantenArtikelNr:'TEST-FLANSCH-03',bezeichnung:'TEST Flansch',
    menge:'4.25',einheitText:'Stück',einzelpreis}]});
});

it('ordnet die erkannten Positionen nur ihrer gespeicherten Rechnungsseite zu',async()=>{
 const roh=JSON.parse(readFileSync('e2e/fixtures/erkennung/TEST_lieferantenrechnung.json','utf8'));
 const seiten=[{pageNumber:1},{pageNumber:2}];
 roh.analyzeResult.pages=seiten;
 const tabelle=roh.analyzeResult.tables[0];
 const zellen=tabelle.cells as {rowIndex:number;columnIndex:number;content:string}[];
 const muster=zellen.filter(zelle=>zelle.rowIndex===1);
 tabelle.boundingRegions=seiten;
 tabelle.cells=[...zellen.filter(zelle=>zelle.rowIndex===0),...[1,2,3].flatMap(zeile=>muster.map(zelle=>({
  ...zelle,rowIndex:zeile,content:zelle.columnIndex===0?'TEST-ZEILE-'+zeile:zelle.content,
  boundingRegions:zeile===3?seiten:[{pageNumber:zeile}],
 })))];
 const {itemId,fileId,lese}=await sichereErkanntesOriginal('Zweiseitiger-Rechnungsbeleg',2,JSON.stringify(roh));
 expect(await sql`SELECT wert->>'positionKey' AS schluessel,fundstelle->>'page' AS seite FROM public.intake_suggestion
  WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='position' AND status='offen' ORDER BY schluessel`)
  .toEqual([{schluessel:'p1',seite:'1'},{schluessel:'p2',seite:'2'},{schluessel:'p3',seite:null}]);
 const lieferant=await withSession(full,()=>createCustomerAction({clientEventId:randomUUID(),customerType:'lieferant',
  companyName:'TEST H8 Sammelrechnung',country:'DE'}));
 if(lieferant.code!=='OK')throw Error('TEST_I3_H8_LIEFERANT:'+lieferant.code);
 const erkannt=await withSession(full,()=>getIntakeCaptureAction(itemId));
 if(erkannt.code!=='OK')throw Error('TEST_I3_H8_QUELLE:'+erkannt.code);
 expect(await withSession(full,()=>selectIntakeConcernAction({itemId,version:erkannt.capture.version,
  clientEventId:randomUUID(),concern:'lieferschein'}))).toMatchObject({code:'OK',capture:{concerns:expect.arrayContaining(['rechnung','lieferschein'])}});
 const rechnungen:string[]=[];
 for(const seite of [1,2]){
  const stand=await withSession(full,()=>getIntakeCaptureAction(itemId));
  if(stand.code!=='OK')throw Error('TEST_I3_H8_QUELLE:'+stand.code);
  const erfasst=await withSession(full,()=>saveIncomingInvoiceAction({itemId,fileId,version:stand.capture.version,
   clientKey:randomUUID(),pages:{from:seite,to:seite},fields:{lieferantId:lieferant.customer.id,nummer:'TEST-H8-'+seite,
    datum:'2026-11-27',netto:'10,00',ust:'0,00',brutto:'10,00',faelligAm:'2026-12-15',iban:'',ibanGeprueft:false},
   status:'offen',paidDate:null,proofFileId:null,duplicateId:null,duplicateReason:null,unclearReason:null}));
  if(erfasst.code!=='OK')throw Error('TEST_I3_H8_RECHNUNG:'+erfasst.code);
  rechnungen.push(erfasst.invoice.id);
  const gelesen=await lese(erfasst.invoice.id);
  expect(gelesen).toMatchObject({rechnungId:erfasst.invoice.id,belegart:'lieferantenrechnung',
   positionen:[{positionKey:'p'+seite,lieferantenArtikelNr:'TEST-ZEILE-'+seite}]});
 }
 expect(await lese()).toMatchObject({belegart:'lieferschein',rechnungId:null});
 // Earlier OCR outputs had only the table and row. A stored correction must outlive the page lookup.
 await sql`UPDATE public.intake_suggestion SET fundstelle=fundstelle-'page',
  wert=CASE WHEN wert->>'positionKey'='p2' THEN jsonb_set(wert,'{bezeichnung}','"TEST gespeicherte Korrektur"') ELSE wert END
  WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='position'`;
 expect(await lese(rechnungen[0])).toMatchObject({positionen:[{positionKey:'p1',lieferantenArtikelNr:'TEST-ZEILE-1'}]});
 expect(await lese(rechnungen[1])).toMatchObject({positionen:[{positionKey:'p2',lieferantenArtikelNr:'TEST-ZEILE-2',
  bezeichnung:'TEST gespeicherte Korrektur'}]});
 expect(await sql`SELECT id FROM public.intake_suggestion
  WHERE tenant_id=${tenant} AND file_id=${fileId}::uuid AND feld='position' AND fundstelle ? 'page'`).toHaveLength(0);
});
