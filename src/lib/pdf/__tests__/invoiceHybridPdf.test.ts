// @vitest-environment node
// Synthetic byte-level container tests, not tax/invoice or PDF/A acceptance.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {inflateSync} from 'node:zlib';
import fontkit from '@pdf-lib/fontkit';
import {it,expect} from 'vitest';
import {PDFArray,PDFDict,PDFDocument,PDFHexString,PDFName,PDFRawStream} from 'pdf-lib';
import {attachInvoiceXml} from '../invoiceHybridPdf';
const issuedAt='2026-11-17T21:20:57.045Z';
const xml=Buffer.from('<?xml version="1.0" encoding="UTF-8"?><synthetic>TEST opaque XML bytes &amp; preservation</synthetic>');
async function rendered(){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(readFileSync(path.join(process.cwd(),'public/pdf/invoice/LiberationSans-Regular.ttf')),{subset:true});
 pdf.addPage().drawText('SYNTHETIC container test ÄÖÜ äöü ß · €',{font,size:12});return pdf.save();
}
function decoded(stream:unknown){if(!(stream instanceof PDFRawStream))throw Error('TEST_PDF_STREAM_MISSING');return stream.dict.get(PDFName.of('Filter'))?.toString()==='/FlateDecode'?inflateSync(stream.contents):Buffer.from(stream.contents);}
it('retains exact opaque XML in one Alternative attachment and uses original time in XMP/Info',async()=>{
 const source=await rendered(),before=source.slice();
 const bytes=await attachInvoiceXml({pdf:source,xml,issuedAt,title:'TEST A&B <R-2026-0001>'});expect(source).toEqual(before);
 const pdf=await PDFDocument.load(bytes,{updateMetadata:false}),af=pdf.catalog.lookup(PDFName.of('AF'),PDFArray);expect(af.size()).toBe(1);
 const file=pdf.context.lookup(af.get(0),PDFDict);expect(file.get(PDFName.of('AFRelationship'))?.toString()).toBe('/Alternative');
 expect(file.lookup(PDFName.of('UF'),PDFHexString).decodeText()).toBe('factur-x.xml');
 const embedded=file.lookup(PDFName.of('EF'),PDFDict).lookup(PDFName.of('F'));expect(decoded(embedded)).toEqual(xml);
 const metadata=decoded(pdf.catalog.lookup(PDFName.of('Metadata'))).toString('utf8');
 expect(metadata).toContain('<pdfaid:part>3</pdfaid:part>');expect(metadata).toContain('<pdfaid:conformance>B</pdfaid:conformance>');expect(metadata).toContain('TEST A&amp;B &lt;R-2026-0001&gt;');
 expect(metadata).toContain('<xmp:CreateDate>2026-11-17T21:20:57Z</xmp:CreateDate>');expect(metadata).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>');expect(metadata).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>');
 expect(pdf.getCreationDate()?.toISOString()).toBe('2026-11-17T21:20:57.000Z');
 const output=pdf.catalog.lookup(PDFName.of('OutputIntents'),PDFArray);expect(output.size()).toBe(1);expect(pdf.context.lookup(output.get(0),PDFDict).get(PDFName.of('S'))?.toString()).toBe('/GTS_PDFA1');
});
it('rejects absent XML or invented current time instead of generating a fallback',async()=>{
 const pdf=await rendered();await expect(attachInvoiceXml({pdf,xml:new Uint8Array(),issuedAt,title:'TEST'})).rejects.toThrow('SOURCE_INCOMPLETE');
 await expect(attachInvoiceXml({pdf,xml,issuedAt:'',title:'TEST'})).rejects.toThrow('SOURCE_TIME_INVALID');
});
