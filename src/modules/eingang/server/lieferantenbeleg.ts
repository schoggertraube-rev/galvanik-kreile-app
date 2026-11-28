import 'server-only';

import {sql} from 'drizzle-orm';
import type {AuthorizationSnapshot} from '@/lib/server/authorization';
import {withTenantSavepoint,type PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import type {LagerBeleg,LagerBelegPosition} from '@/modules/lager/public';
import {invoiceDate} from '../invoiceContract';
import {gespeichertesBelegoriginal,invoicePageFilter} from './intakeOriginal';
import {readIntakePositionValues} from './intakeRecognitionPositions';

type Belegdatei = { id: string; sha256: string; status: string };
type Eingang = {
 id: string;
 anliegen: string[];
 kundeId: string | null;
 zuordnung: string;
 einsatzAktion: string | null;
 dateien: Belegdatei[];
 erkennungFertig: boolean;
};
type Hinweis = { feld: string; wert: unknown; sicherheit: string | null };
type Rechnung = { id: string; fileId: string; nummer: string | null; datum: string | null; zahlstatus: string;
 lieferantId: string | null; seiteVon: number | null; seiteBis: number | null };

function text(wert: unknown): string | null {
 return typeof wert === 'string' ? wert.trim() || null : null;
}

function sicherheit(wert: string | null): number | null {
 if (wert === null || !wert.trim()) return null;
 const zahl = Number(wert);
 return Number.isFinite(zahl) && zahl >= 0 && zahl <= 1 ? zahl : null;
}

function lesePositionen(hinweise: readonly Hinweis[]): LagerBelegPosition[] {
 const positionen = new Map<string,LagerBelegPosition>();
 for (const hinweis of hinweise) {
  if (hinweis.feld !== 'position' || !hinweis.wert || typeof hinweis.wert !== 'object' || !('positionKey' in hinweis.wert)) continue;
  const {positionKey,...werte} = hinweis.wert;
  if (typeof positionKey !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/u.test(positionKey) || positionen.has(positionKey)) continue;
  positionen.set(positionKey,{positionKey,...readIntakePositionValues(werte),sicherheit:sicherheit(hinweis.sicherheit)});
 }
 return [...positionen.values()];
}

async function leseBeleg(tx: PrivilegedTenantTransaction, tenantId: string, itemId: string, rechnungId?:string): Promise<LagerBeleg | null> {
 const [eingang] = await tx.execute<Eingang>(sql`
  SELECT item.id::text,item.anliegen,item.kunde_id AS "kundeId",item.zuordnung,item.einsatz_aktion AS "einsatzAktion",
    coalesce((SELECT jsonb_agg(jsonb_build_object('id',file.id,'sha256',file.sha256,'status',file.erkennung_status)
      ORDER BY (file.erkennung_status='fertig') DESC,file.reihenfolge,file.id)
     FROM public.intake_file file WHERE file.tenant_id=item.tenant_id AND file.item_id=item.id
      AND ${gespeichertesBelegoriginal}),'[]'::jsonb) AS dateien,
    NOT EXISTS(SELECT 1 FROM public.intake_file datei WHERE datei.tenant_id=item.tenant_id AND datei.item_id=item.id
      AND datei.erkennung_status NOT IN ('fertig','fehler')) AS "erkennungFertig"
  FROM public.intake_item item WHERE item.tenant_id=${tenantId} AND item.id=${itemId}::uuid`);
 if (!eingang || !eingang.dateien[0]) return null;
 const belegart = eingang.anliegen.includes('lieferschein') ? 'lieferschein'
  : eingang.anliegen.includes('rechnung') ? 'lieferantenrechnung' : null;
 if (belegart === null) return null;
 if(rechnungId&&belegart!=='lieferantenrechnung')return null;
 const rechnungen=belegart==='lieferantenrechnung'?await tx.execute<Rechnung>(sql`
  SELECT id::text,file_id::text AS "fileId",nummer,datum::text,zahlstatus,lieferant_id AS "lieferantId",
    seite_von AS "seiteVon",seite_bis AS "seiteBis"
  FROM public.supplier_invoice WHERE tenant_id=${tenantId} AND item_id=${itemId}::uuid
    ${rechnungId?sql`AND id=${rechnungId}::uuid`:sql``} LIMIT 2`):[];
 if(rechnungen.length>1)throw Error('CONFLICT');
 const rechnung=rechnungen[0];
 if(rechnungId&&!rechnung)return null;
 const original=rechnung?eingang.dateien.find(datei=>datei.id===rechnung.fileId):eingang.dateien[0];
 if(!original)throw Error('EINGANG_BELEG_ORIGINAL_FEHLT');
 const seiten=rechnung&&rechnung.seiteVon!==null&&rechnung.seiteBis!==null
  ?{from:rechnung.seiteVon,to:rechnung.seiteBis}:null;
 const lieferantId=rechnung?rechnung.lieferantId:eingang.kundeId;

 const hinweise = await tx.execute<Hinweis>(sql`
  SELECT s.feld,s.wert,s.sicherheit_wert::text AS sicherheit
  FROM public.intake_suggestion s LEFT JOIN public.intake_file file
    ON file.tenant_id=s.tenant_id AND file.id=s.file_id AND file.item_id=s.item_id
  WHERE s.tenant_id=${tenantId} AND s.item_id=${itemId}::uuid AND s.status IN ('offen','uebernommen')
    AND s.feld IN ('beleg.nummer','beleg.datum','rechnung.nummer','rechnung.datum','waehrung','bestellnummer','lieferscheinnummer','position')
    AND (s.file_id IS NULL AND s.feld<>'position' OR ${gespeichertesBelegoriginal})
    ${belegart==='lieferantenrechnung'?sql`AND s.file_id=${original.id}::uuid`:sql``}
    ${seiten?sql`AND ${invoicePageFilter(seiten)}`:sql``}
  ORDER BY CASE WHEN s.feld='position' THEN file.reihenfolge ELSE 0 END,
    CASE WHEN s.feld='position' AND s.wert->>'positionKey' ~ '^p[1-9][0-9]{0,9}$' THEN substring(s.wert->>'positionKey' FROM 2)::bigint END NULLS LAST,
    (s.status='uebernommen') DESC,s.geprueft_am DESC NULLS LAST,s.sicherheit_wert DESC NULLS LAST,file.reihenfolge,s.id`);

 const lieferanten = await tx.execute<{ id:string; name:string; zugeordnet:boolean; sicherheit:string|null; grund:string|null }>(sql`
  WITH hinweise AS (
   SELECT DISTINCT ON (s.wert #>> '{}') s.wert #>> '{}' AS id,s.status,s.grund,s.sicherheit_wert
   FROM public.intake_suggestion s WHERE s.tenant_id=${tenantId} AND s.item_id=${itemId}::uuid
    AND s.feld='kunde' AND s.status IN ('offen','uebernommen') AND jsonb_typeof(s.wert)='string'
   ORDER BY s.wert #>> '{}',(s.status='uebernommen') DESC,s.sicherheit_wert DESC NULLS LAST,s.id
  )
  SELECT l.id,l.name,l.id IS NOT DISTINCT FROM ${lieferantId}::text AS zugeordnet,
   h.sicherheit_wert::text AS sicherheit,CASE WHEN h.status='offen' THEN h.grund END AS grund
  FROM public.v_eingang_lieferanten_v1 l LEFT JOIN hinweise h ON h.id=l.id
  WHERE l.tenant_id=${tenantId} AND (l.id=${lieferantId} OR h.status='offen' AND h.grund IS NOT NULL)
  ORDER BY zugeordnet DESC,h.sicherheit_wert DESC NULLS LAST,l.id LIMIT 4`);
 const lieferant = lieferanten.find(zeile=>zeile.zugeordnet);
 const vorschlag = (feld: string) => text(hinweise.find(zeile=>zeile.feld===feld)?.wert);
 const datum = rechnung?.datum ?? vorschlag(belegart==='lieferantenrechnung'?'rechnung.datum':'beleg.datum');
 const waehrung = vorschlag('waehrung');
 const lieferscheinNummern = new Set(hinweise.flatMap(zeile=>zeile.feld==='lieferscheinnummer' ? [text(zeile.wert)].filter(v=>v!==null) : []));

 return {
  itemId:eingang.id,fileId:original.id,dokumentSha256:original.sha256,belegart,
  belegnummer:rechnung?.nummer ?? vorschlag(belegart==='lieferantenrechnung'?'rechnung.nummer':'beleg.nummer'),
  belegdatum:datum&&invoiceDate(datum)?datum:null,
  lieferantId:lieferant?.id??null,
  lieferantSicherheit:lieferant ? rechnung||['bestaetigt','hand'].includes(eingang.zuordnung)?1:sicherheit(lieferant.sicherheit) : null,
  lieferantKandidaten:lieferanten.flatMap(({id,name,grund})=>grund ? [{id,name,grund}] : []).slice(0,3),
  waehrung:waehrung&&/^[A-Z]{3}$/u.test(waehrung)?waehrung:null,
  rechnungId:rechnung?.id??null,
  bezug:{lieferscheinNummern:[...lieferscheinNummern],bestellNummer:vorschlag('bestellnummer')},
  erkennungFertig:eingang.erkennungFertig,
  gueltig:eingang.einsatzAktion!=='kein_gv'&&rechnung?.zahlstatus!=='ungueltig'&&rechnung?.zahlstatus!=='doppelt',
  positionen:lesePositionen(hinweise),
 };
}

export async function leseLieferantenbelegFuerLagerInTransaction(tx: PrivilegedTenantTransaction,
 auth: AuthorizationSnapshot, itemId: string, rechnungId?:string): Promise<LagerBeleg | null> {
 try {
  return await withTenantSavepoint(tx,async nested=>{
   await nested.execute(sql`SET LOCAL statement_timeout='2000ms'`);
   return leseBeleg(nested,auth.tenantId,itemId,rechnungId);
  });
 } catch(error) {
  const ursache = error instanceof Error && error.cause ? error.cause : error;
  if (typeof ursache === 'object' && ursache !== null && 'code' in ursache && ursache.code === '57014')
   throw Error('EINGANG_BELEG_LESEN_FRIST',{cause:error});
  throw error;
 }
}
