import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

export type LagerBadanalyse = Readonly<{
  badId: string;
  metall: string;
  analyseAm: string;
  grammProLiter: string;
  volumenLiter: string;
  belegId: string;
  originalDateiId: string;
}>;

export async function speichereLagerBadanalyseInTransaction(
  tx: PrivilegedTenantTransaction,
  analyse: LagerBadanalyse,
) {
  const [beleg] = await tx.execute<{ id: string }>(sql`
    SELECT private.lager_badanalyse_speichern(
      ${analyse.badId}, ${analyse.metall}, ${analyse.analyseAm}::timestamptz,
      ${analyse.grammProLiter}::numeric, ${analyse.volumenLiter}::numeric, ${analyse.belegId}::uuid,
      ${analyse.originalDateiId}::uuid
    )::text AS id
  `);
  if (!beleg) throw Error("LAGER_BADANALYSE_FEHLT");
  return beleg.id;
}

export async function leseLagerBadprozessbestandInTransaction(
  tx: PrivilegedTenantTransaction,
  stichtag: string,
) {
  return [...await tx.execute<{
    badId: string;
    metall: string;
    analyseAm: string;
    grammProLiter: string;
    volumenLiter: string;
    feinGramm: string;
    belegId: string;
    originalDateiId: string;
  }>(sql`
    SELECT bad_id AS "badId", metall, analyse_am::text AS "analyseAm", g_pro_l::text AS "grammProLiter",
      volumen_l::text AS "volumenLiter", fein_g::text AS "feinGramm", beleg_id::text AS "belegId",
      datei_id::text AS "originalDateiId"
    FROM private.lager_badprozessbestand_am(${stichtag}::timestamptz)
  `)];
}
