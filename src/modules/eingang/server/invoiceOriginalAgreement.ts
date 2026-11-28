import 'server-only';

import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {eingangCopy} from '@/ui/eingangCopy';
import type {InvoicePageRange} from '../invoiceContract';
import {findeRechnungswiderspruch,rechnungsBelegwerte} from './eingangsRegeln';
import {gespeichertesBelegoriginal} from './intakeOriginal';

type Druckwert={field:string;value:unknown;page:number|null};
type Original={id:string;art:'pdf'|'xml';werte:Druckwert[]};

export async function liesGetrenntenRechnungswiderspruch(tx:PrivilegedTenantTransaction,
 tenantId:string,itemId:string,fileId:string,pages:InvoicePageRange|null=null){
 const quellen=await tx.execute<{fileId:string;art:'pdf'|'xml';feld:string;wert:unknown;seite:string|null}>(sql`
  SELECT file.id::text AS "fileId",CASE WHEN file.mime='application/pdf' THEN 'pdf' ELSE 'xml' END AS art,
    s.feld,s.wert,s.fundstelle->>'page' AS seite
  FROM public.intake_file file JOIN public.intake_suggestion s
    ON s.tenant_id=file.tenant_id AND s.item_id=file.item_id AND s.file_id=file.id
  WHERE file.tenant_id=${tenantId} AND file.item_id=${itemId}::uuid AND ${gespeichertesBelegoriginal}
    AND s.status IN ('offen','uebernommen') AND (
     file.mime='application/pdf' AND (s.feld='rechnung.druckbild' OR (
      file.erkennung_roh_pfad IS NOT NULL AND s.feld IN ('rechnung.nummer','rechnung.betrag')
      AND s.fundstelle->>'format' IS NULL
      AND NOT EXISTS(SELECT 1 FROM public.intake_suggestion druck WHERE druck.tenant_id=file.tenant_id
       AND druck.file_id=file.id AND druck.feld='rechnung.druckbild' AND druck.status IN ('offen','uebernommen'))))
     OR file.mime<>'application/pdf' AND s.fundstelle->>'format' IN ('UBL','CII')
        AND s.feld IN ('rechnung.nummer','rechnung.betrag'))
  ORDER BY file.reihenfolge,file.id,s.id`);
 const originale=new Map<string,Original>();
 for(const quelle of quellen){
  const original:Original=originale.get(quelle.fileId)??{id:quelle.fileId,art:quelle.art,werte:[]};
  if(quelle.feld==='rechnung.druckbild'&&Array.isArray(quelle.wert)){
   for(const wert of quelle.wert){
    if(!wert||typeof wert!=='object'||!['rechnung.nummer','rechnung.betrag'].includes(wert.field)
      ||!Number.isSafeInteger(wert.page)||wert.page<1)continue;
    if(pages&&quelle.fileId===fileId&&(wert.page<pages.from||wert.page>pages.to))continue;
    original.werte.push({field:wert.field,value:wert.value,page:wert.page});
   }
  }else if(quelle.feld!=='rechnung.druckbild'){
   const seite=quelle.seite&&/^\d+$/u.test(quelle.seite)?Number(quelle.seite):null;
   if(!pages||quelle.fileId!==fileId||quelle.art==='xml'||seite!==null&&seite>=pages.from&&seite<=pages.to)
    original.werte.push({field:quelle.feld,value:quelle.wert,page:seite});
  }
  originale.set(original.id,original);
 }
 const gewaehltes=originale.get(fileId);
 if(!gewaehltes?.werte.length)return null;
 const nummer=rechnungsBelegwerte(gewaehltes.werte).nummer;
 const andere=[...originale.values()].filter(original=>original.art!==gewaehltes.art&&original.werte.length);
 const gleiche=nummer===null?[]:andere.filter(original=>rechnungsBelegwerte(original.werte).nummer===nummer);
 // Several invoices on one intake are common. Compare only a unique match or a lone pair of originals.
 const partner=gleiche.length===1?gleiche[0]:andere.length===1&&originale.size===2?andere[0]:null;
 if(!partner)return null;
 const [pdf,xml]=gewaehltes.art==='pdf'?[gewaehltes,partner]:[partner,gewaehltes];
 const widerspruch=findeRechnungswiderspruch(xml.werte,pdf.werte);
 if(!widerspruch)return null;
 const feld=widerspruch.xml.nummer!==null&&widerspruch.pdf.nummer!==null&&widerspruch.xml.nummer!==widerspruch.pdf.nummer
  ?'rechnung.nummer':'rechnung.betrag';
 return {...widerspruch,pdfId:pdf.id,xmlId:xml.id,page:pdf.werte.find(wert=>wert.field===feld)?.page??null};
}

export async function speichereGetrenntenRechnungswiderspruch(tx:PrivilegedTenantTransaction,
 tenantId:string,itemId:string,fileId:string){
 const abgleich=await liesGetrenntenRechnungswiderspruch(tx,tenantId,itemId,fileId);
 if(!abgleich)return;
 const {pdfId,xmlId,page,...werte}=abgleich;
 const wert=JSON.stringify({...werte,pdfId,xmlId});
 await tx.execute(sql`INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,regel,grund,fundstelle,status)
  SELECT ${tenantId},${itemId}::uuid,datei.id,'rechnung.abgleich',${wert}::jsonb,'unsicher','datei',
    ${eingangCopy.rechnungswiderspruch},jsonb_build_object('format','PDF/XML','page',CASE WHEN datei.id=${pdfId}::uuid THEN ${page}::integer END),'offen'
  FROM (VALUES (${pdfId}::uuid),(${xmlId}::uuid)) datei(id)
  WHERE NOT EXISTS(SELECT 1 FROM public.intake_suggestion s WHERE s.tenant_id=${tenantId} AND s.item_id=${itemId}::uuid
    AND s.file_id=datei.id AND s.feld='rechnung.abgleich' AND s.wert=${wert}::jsonb AND s.status<>'verworfen')`);
}
