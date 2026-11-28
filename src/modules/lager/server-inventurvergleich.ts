import "server-only";

import { sql } from "drizzle-orm";
import type { ActionResult } from "@/lib/server/authHelper";
import { LAGER_BUCHUNG_COPY } from "@/ui/lagerBuchungCopy";
import { imInventurPort } from "./server-inventur";
import type { LagerEinstellungenLeser } from "./server-lagerregeln";

type InventurVergleichZeile = {
  artikelId: string; kurznummer: number | null; artikelName: string; einheit: string | null;
  soll: string | null; zuletztGezaehlt: string | null; gezaehltAm: string | null;
  abweichung: string | null; zaehlungVollstaendig: boolean;
};
export type InventurVergleichStand = { sichtbar: false } | { sichtbar: true; zeilen: InventurVergleichZeile[] };

export function leseLagerInventurVergleich(
  liesEinstellungen: LagerEinstellungenLeser,
): Promise<ActionResult<InventurVergleichStand>> {
  return imInventurPort<InventurVergleichStand>(async (tx, _akteur, auth) => {
    if ((await liesEinstellungen(auth.tenantId, tx))?.automatische_inventur_aktiv !== true) {
      return { ok: true, data: { sichtbar: false } };
    }
    const zeilen = await tx.execute<InventurVergleichZeile>(sql`
      SELECT artikel_id AS "artikelId", kurznummer, artikel_name AS "artikelName", einheit,
        soll::text, zuletzt_gezaehlt::text AS "zuletztGezaehlt", gezaehlt_am::text AS "gezaehltAm",
        abweichung::text, zaehlung_vollstaendig AS "zaehlungVollstaendig"
      FROM private.lager_inventur_vergleich()`);
    return { ok: true, data: { sichtbar: true, zeilen: [...zeilen] } };
  }, ["lager.lesen"], LAGER_BUCHUNG_COPY.leserecht);
}
