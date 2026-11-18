import {readFileSync} from 'node:fs';
import path from 'node:path';
import {AFRelationship,PDFDocument,PDFName,PDFString} from 'pdf-lib';

const PRODUCER='Kreile WerkstattCockpit / pdf-lib 1.17.1';
const CREATOR='Kreile WerkstattCockpit';
const FX_NAMESPACE='urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#';
const xmlText=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');

/** Container only, not an invoice calculator, issuer or validator. The existing
 * writer must first validate its frozen sources/XML and render embedded fonts.
 * Neither the invoice bytes nor the supplied XML are persisted here. */
export async function attachInvoiceXml(input:{pdf:Uint8Array;xml:Uint8Array;issuedAt:string;title:string}):Promise<Uint8Array>{
 if(input.pdf.length===0||input.xml.length===0||input.xml.length>20*1024*1024||!input.title.trim())throw Error('INVOICE_HYBRID_SOURCE_INCOMPLETE');
 const date=new Date(input.issuedAt);
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.issuedAt)||!Number.isFinite(date.getTime())||date.toISOString()!==input.issuedAt)throw Error('INVOICE_HYBRID_SOURCE_TIME_INVALID');
 const instant=date.toISOString().replace(/\.\d{3}Z$/,'Z');
 const pdf=await PDFDocument.load(input.pdf,{updateMetadata:false});
 pdf.setTitle(input.title);pdf.setAuthor(CREATOR);pdf.setCreator(CREATOR);pdf.setProducer(PRODUCER);pdf.setCreationDate(date);pdf.setModificationDate(date);
 await pdf.attach(input.xml,'factur-x.xml',{mimeType:'text/xml',description:'Factur-X EN16931 XML',creationDate:date,modificationDate:date,afRelationship:AFRelationship.Alternative});
 const properties=['DocumentFileName','DocumentType','Version','ConformanceLevel'].map(name=>`<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X ${name}</pdfaProperty:description></rdf:li>`).join('');
 const metadata=`<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlText(input.title)}</rdf:li></rdf:Alt></dc:title><dc:creator><rdf:Seq><rdf:li>${CREATOR}</rdf:li></rdf:Seq></dc:creator></rdf:Description>
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>${CREATOR}</xmp:CreatorTool><xmp:CreateDate>${instant}</xmp:CreateDate><xmp:ModifyDate>${instant}</xmp:ModifyDate></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>${PRODUCER}</pdf:Producer></rdf:Description>
<rdf:Description rdf:about="" xmlns:fx="${FX_NAMESPACE}"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>EN 16931</fx:ConformanceLevel></rdf:Description>
<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"><pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDF/A Extension Schema</pdfaSchema:schema><pdfaSchema:namespaceURI>${FX_NAMESPACE}</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>${properties}</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>
</rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
 pdf.catalog.set(PDFName.of('Metadata'),pdf.context.register(pdf.context.stream(Buffer.from(metadata,'utf8'),{Type:'Metadata',Subtype:'XML'})));
 const icc=pdf.context.register(pdf.context.stream(readFileSync(path.join(process.cwd(),'public/pdf/invoice/sRGB.icc')),{N:3}));
 const intent=pdf.context.register(pdf.context.obj({Type:'OutputIntent',S:'GTS_PDFA1',OutputConditionIdentifier:PDFString.of('sRGB IEC61966-2.1'),Info:PDFString.of('sRGB IEC61966-2.1'),DestOutputProfile:icc}));
 pdf.catalog.set(PDFName.of('OutputIntents'),pdf.context.obj([intent]));
 return pdf.save({useObjectStreams:false});
}
