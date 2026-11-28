import 'server-only';

import {sql} from 'drizzle-orm';
import type {PrivilegedTenantTransaction} from '@/lib/server/privilegedDb';
import {eingangCopy} from '@/ui/eingangCopy';

const nummerFelder = {
  rechnung: ['rechnung.nummer', 'beleg.nummer'],
  lieferschein: ['lieferscheinnummer', 'beleg.nummer'],
  quittung: ['beleg.nummer'],
} as const;

export type Belegart = keyof typeof nummerFelder;

export function istBelegart(art: string | null): art is Belegart {
  return art !== null && Object.hasOwn(nummerFelder, art);
}

export async function schlageBelegidentitaetVor(tx: PrivilegedTenantTransaction, quelle: {
  tenantId: string; fileId: string; art: Belegart;
}) {
  const {tenantId, fileId, art} = quelle;
  const nummern = sql.join(nummerFelder[art].map(feld => sql`${feld}`), sql`, `);
  await tx.execute(sql`
    WITH belegwerte AS (
      SELECT f.id AS original_id, item.id AS item_id, item.kanal, item.kunde_id,
        coalesce(item.empfangen_am,item.erstellt_am) AS eingang_am,
        CASE WHEN s.feld IN (${nummern}) AND jsonb_typeof(s.wert)='string'
          THEN nullif(btrim(s.wert #>> '{}'),'') END AS nummer,
        CASE s.feld WHEN 'lieferant.ustid' THEN s.wert #>> '{}' WHEN 'rechnung.absender' THEN s.wert->>'ustId' END AS ustid
      FROM public.intake_suggestion s
      JOIN public.intake_file f ON f.tenant_id=s.tenant_id AND f.id=s.file_id AND f.item_id=s.item_id
      JOIN public.intake_item item ON item.tenant_id=f.tenant_id AND item.id=f.item_id
      WHERE s.tenant_id=${tenantId} AND s.feld IN (${nummern},'lieferant.ustid','rechnung.absender')
        AND s.status IN ('offen','uebernommen') AND item.richtung='rein' AND item.aussortiert IS NULL
        AND EXISTS (SELECT 1 FROM public.intake_event e WHERE e.tenant_id=f.tenant_id AND e.item_id=f.item_id
          AND e.art='original_gespeichert' AND e.nachher->>'fileId'=f.id::text AND e.nachher->>'sha256'=f.sha256)
        AND (f.id=${fileId}::uuid OR EXISTS (SELECT 1 FROM public.intake_event e WHERE e.tenant_id=f.tenant_id AND e.item_id=f.item_id
          AND e.art='erkannt' AND e.nachher->>'fileId'=f.id::text AND e.nachher->>'kind'=${art} AND e.nachher->>'code'='OK'))
        AND NOT EXISTS (SELECT 1 FROM public.intake_suggestion abgleich WHERE abgleich.tenant_id=f.tenant_id
          AND abgleich.file_id=f.id AND abgleich.feld='rechnung.abgleich' AND abgleich.status<>'verworfen')
    ), beleg AS (
      SELECT original_id, item_id, kanal, kunde_id, eingang_am, min(nummer) AS nummer,
        CASE WHEN count(DISTINCT nullif(upper(regexp_replace(ustid,'[[:space:]]','','g')),''))=1
          THEN min(nullif(upper(regexp_replace(ustid,'[[:space:]]','','g')),'')) END AS ustid
      FROM belegwerte GROUP BY original_id,item_id,kanal,kunde_id,eingang_am
      HAVING count(DISTINCT nummer)=1
    ), paar AS (
      SELECT CASE WHEN (a.eingang_am,a.item_id)>(b.eingang_am,b.item_id) THEN a.item_id ELSE b.item_id END AS juenger,
        CASE WHEN (a.eingang_am,a.item_id)>(b.eingang_am,b.item_id) THEN a.original_id ELSE b.original_id END AS original_id,
        CASE WHEN (a.eingang_am,a.item_id)<(b.eingang_am,b.item_id) THEN a.item_id ELSE b.item_id END AS aelter
      FROM beleg a JOIN beleg b ON b.item_id<>a.item_id AND b.kanal<>a.kanal AND b.nummer=a.nummer
        AND (b.kunde_id=a.kunde_id OR b.ustid=a.ustid)
        AND (a.ustid IS NULL OR b.ustid IS NULL OR a.ustid=b.ustid)
      WHERE a.original_id=${fileId}::uuid
      ORDER BY b.eingang_am,b.item_id,b.original_id LIMIT 1
    )
    INSERT INTO public.intake_suggestion(tenant_id,item_id,file_id,feld,wert,sicherheit,regel,grund,status)
    SELECT ${tenantId},paar.juenger,paar.original_id,'beleg.identitaet',jsonb_build_object('itemId',paar.aelter),
      'vorschlag','beleg.identitaet',${eingangCopy.gleicherBeleg},'offen' FROM paar
    WHERE NOT EXISTS(SELECT 1 FROM public.intake_suggestion bekannt WHERE bekannt.tenant_id=${tenantId}
      AND bekannt.item_id=paar.juenger AND bekannt.feld='beleg.identitaet' AND bekannt.status<>'verworfen'
      AND bekannt.wert->>'itemId'=paar.aelter::text)
  `);
}
