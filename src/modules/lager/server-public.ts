import "server-only";

import { hasLagerCapability } from "@/lib/auth/authorizationContract";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {
  leseLagerArtikel,
  leseLagerGebindeZumStichtag,
  leseLagerEntwuerfeFuerHeute,
  leseLagerMetallkurs,
  leseLagerMetallstamm,
  leseLagerOrte,
  type MetallkursSuche,
} from "./server/stammdatenLesen";

import { istStammauftrag, type Stammantwort } from "./stammbefehl";
import { schreibeLagerStamm, type LagerTaskPorts } from "./server/stammdatenSchreiben";
export type { LagerTaskPorts } from "./server/stammdatenSchreiben";

const artikelIdMuster = /^[A-Za-z0-9_-]{1,128}$/;

export async function getLagerArtikelZumStichtag(artikelId: string, fachzeit: Date) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, code: "UNAUTHORIZED" } as const;
  if (!hasLagerCapability(auth.data, "lager.lesen")) return { ok: false, code: "FORBIDDEN" } as const;
  if (!artikelIdMuster.test(artikelId) || !(fachzeit instanceof Date) || !Number.isFinite(fachzeit.getTime())) {
    return { ok: false, code: "VALIDATION_ERROR" } as const;
  }

  return withPrivilegedTenantTransaction(auth.data, async (tx) => {
    const { tenantId } = auth.data;
    const artikel = await leseLagerArtikel(tx, tenantId, artikelId);
    if (!artikel) return { ok: true, data: null } as const;
    const gebinde = await leseLagerGebindeZumStichtag(tx, tenantId, artikel.id, fachzeit);
    return { ok: true, data: { artikel, gebinde } } as const;
  });
}

export async function getLagerMetallstamm(artikelId: string) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, code: "UNAUTHORIZED" } as const;
  if (!hasLagerCapability(auth.data, "lager.werte")) return { ok: false, code: "FORBIDDEN" } as const;
  if (!artikelIdMuster.test(artikelId)) return { ok: false, code: "VALIDATION_ERROR" } as const;

  return withPrivilegedTenantTransaction(auth.data, async (tx) => ({
    ok: true, data: await leseLagerMetallstamm(tx, auth.data.tenantId, artikelId),
  } as const));
}

export async function getLagerMetallkurs(suche: MetallkursSuche) {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, code: "UNAUTHORIZED" } as const;
  if (!hasLagerCapability(auth.data, "lager.werte")) return { ok: false, code: "FORBIDDEN" } as const;
  const datum = new Date(suche.datum);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(suche.datum) || !Number.isFinite(datum.getTime())
      || datum.toISOString().slice(0, 10) !== suche.datum || suche.datum.startsWith("0000")
      || !suche.metall.trim() || !suche.quelle.trim()) {
    return { ok: false, code: "VALIDATION_ERROR" } as const;
  }

  return withPrivilegedTenantTransaction(auth.data, async (tx) => ({
    ok: true, data: await leseLagerMetallkurs(tx, auth.data.tenantId, suche),
  } as const));
}

export async function speichereLagerStammdaten(auftrag: unknown, ports: LagerTaskPorts): Promise<Stammantwort> {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, code: "UNAUTHENTICATED" };
  if (!istStammauftrag(auftrag)) return { ok: false, code: "VALIDATION_ERROR" };
  return schreibeLagerStamm(auth.data, auftrag, ports);
}

/** Verknüpft die im Eingang bestätigte Variantenwahl mit dem dort gesicherten Original. */
export async function bestaetigeLagerEtikettZuordnung(input: {
  befehlId: string; eingangId: string; fotoId: string; artikelId: string; version: number;
}, ports: LagerTaskPorts): Promise<Stammantwort> {
  return speichereLagerStammdaten({
    befehlId: input.befehlId,
    daten: {
      art: "artikel.foto_zuordnen",
      id: input.artikelId,
      version: input.version,
      fotoId: input.fotoId,
      eingangId: input.eingangId,
    },
  }, ports);
}

export async function getLagerEntwuerfeFuerHeute() {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, code: "UNAUTHORIZED" } as const;
  if (!hasLagerCapability(auth.data, "lager.stamm")) return { ok: false, code: "FORBIDDEN" } as const;
  return withPrivilegedTenantTransaction(auth.data, async (tx) => ({
    ok: true, data: await leseLagerEntwuerfeFuerHeute(tx, auth.data.tenantId),
  } as const));
}

export { readMetallstammInTransaction, readMetallkursInTransaction } from "./metall-intern";

export async function getLagerOrte() {
  const auth = await resolveAuthorization();
  if (!auth.ok) return { ok: false, code: "UNAUTHORIZED" } as const;
  if (!hasLagerCapability(auth.data, "lager.lesen")) return { ok: false, code: "FORBIDDEN" } as const;
  return withPrivilegedTenantTransaction(auth.data, async (tx) => ({
    ok: true, data: await leseLagerOrte(tx, auth.data.tenantId),
  } as const));
}
