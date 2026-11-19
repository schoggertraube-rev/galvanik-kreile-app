// @vitest-environment node
// Explicit synthetic collection boundary. Real collection issuer evidence is separate.
import {expect,it} from 'vitest';
import {renderToBuffer} from '@react-pdf/renderer';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {readInvoiceVat} from '@/modules/accounting/public';
import {createImmutableInvoicePdfDocument,createImmutableInvoiceCancellationPdfDocument,type ImmutableInvoiceCollectionSnapshot} from '../ImmutableInvoiceDocument';
import {E_INVOICE_COPY} from '@/ui/situationCatalog';

it('prints every actual collection member/date on original and cancellation using the same document source',async()=>{
 const members=[0,1].map(index=>({orderId:'TEST-order-'+index,orderVersion:3,orderNumber:'TEST-SOURCE-'+index,title:'TEST service '+index,freezeId:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'][index],serviceDate:['2026-10-30','2026-11-18'][index]}));
 const snapshot:ImmutableInvoiceCollectionSnapshot={schemaVersion:3,
 seller:{companyName:'TEST seller',street:'TEST Weg 1',zip:'70176',city:'Stuttgart',country:'DE',vatId:'DE123456789',taxNumber:null,iban:'DE02120300000000202051',bic:'BYLADEM1001',bankName:'TEST Bank'},
 customer:{name:'TEST buyer',companyName:null,contactPerson:null,street:'TEST Weg 2',zip:'70176',city:'Stuttgart',country:'DE',vatId:null},
 order:null,serviceDate:null,collection:{collectionId:'33333333-3333-4333-8333-333333333333',version:3,month:'2026-11-01',members},
 lines:members.map((member,index)=>({type:'BASE',sourceOrderId:member.orderId,itemId:'TEST-item-'+index,name:'TEST goods '+index,quantity:1,unitNetAmountCents:5000,lineNetAmountCents:5000,unit:'C62',taxCategory:'S',vat_rate_basis_points:1900})),
 totals:{netAmountCents:10000,vatRateBasisPoints:null,vatAmountCents:1900,grossAmountCents:11900,vatBreakdown:[{rateBp:1900,netCents:10000,vatCents:1900,grossCents:11900}]},issuedAt:'2026-11-19T12:00:00.000Z',paymentTermDays:14};
 const unchanged=structuredClone(snapshot),common={invoiceNumber:'R-2026-0042',dueDate:'2026-12-03',snapshot,vat:readInvoiceVat(snapshot)};
 const documents=[createImmutableInvoicePdfDocument(common),createImmutableInvoiceCancellationPdfDocument({...common,cancelReason:'TEST actual duplicate',cancelledAt:'2026-11-20T12:00:00.000Z',cancellationNumber:'R-2026-0043'})];
 for(const element of documents){
  const bytes=await renderToBuffer(element),loading=getDocument({data:Uint8Array.from(bytes),verbosity:0});
  try{
   const pdf=await loading.promise,fragments:string[]=[];
   for(let page=1;page<=pdf.numPages;page++)for(const item of (await(await pdf.getPage(page)).getTextContent()).items)if('str'in item)fragments.push(item.str);
   const text=fragments.join(' ');
   for(const [index,member] of members.entries())expect(text).toContain(E_INVOICE_COPY.collectionMember(member.orderNumber,['30.10.2026','18.11.2026'][index]));
   expect(text).toContain('TEST goods 0');expect(text).toContain('TEST goods 1');
   expect(text).not.toContain('Leistungsdatum: 01.11.2026');
  }finally{await loading.destroy();}
 }
 expect(snapshot).toEqual(unchanged);
},60_000);
