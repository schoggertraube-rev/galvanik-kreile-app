import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea } from "@/lib/auth/authorizationContract";
import { formatEuro } from "@/lib/domain/formatEuro";
import { MEHRARBEIT_FREIGABE_VORLAGE, pruefeMehrarbeitVorlage, renderMehrarbeitVorlage } from "@/lib/email/templateContract";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { MehrarbeitEinstellungenInput } from "../public";

type MehrarbeitEinstellungen = Omit<MehrarbeitEinstellungenInput, "revision"> & { firma: string | null };

async function readMehrarbeitEinstellungen(tx: PrivilegedTenantTransaction, tenantId: string) {
  const zeilen = await tx.execute<MehrarbeitEinstellungen>(sql`
    SELECT mehrarbeit_spielraum_basispunkte AS "spielraumBasispunkte",
      mehrarbeit_stopp_basispunkte AS "stoppBasispunkte",
      mehrarbeit_schritt_minuten AS "schrittMinuten",
      mehrarbeit_max_minuten_je_taetigkeit AS "maximalMinutenJeTaetigkeit",
      nullif(btrim(company_name), '') AS firma
    FROM public.company_settings
    WHERE tenant_id=${tenantId}
      AND tenant_id=nullif(current_setting('app.tenant_id', true), '')
    LIMIT 2
  `);
  return zeilen.length === 1 ? zeilen[0] : null;
}

export async function readMehrarbeitEinstellwerteInTransaction(
  tx: PrivilegedTenantTransaction, tenantId: string,
): Promise<MehrarbeitEinstellungenInput | null> {
  const stand = await readMehrarbeitEinstellungen(tx, tenantId);
  if (!stand) return null;
  const { spielraumBasispunkte, stoppBasispunkte, schrittMinuten, maximalMinutenJeTaetigkeit } = stand;
  const revision = [spielraumBasispunkte, stoppBasispunkte, schrittMinuten, maximalMinutenJeTaetigkeit].join(":");
  return { revision, spielraumBasispunkte, stoppBasispunkte, schrittMinuten, maximalMinutenJeTaetigkeit };
}

type MehrarbeitEingabeErgebnis =
  | { wert: MehrarbeitEinstellungenInput }
  | { fehler: "revisionUngueltig" | "spielraumUngueltig" | "stoppUngueltig" | "minutenUngueltig" };

export function parseMehrarbeitEinstellwerte(value: unknown): MehrarbeitEingabeErgebnis {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { fehler: "revisionUngueltig" };
  }
  const { revision, spielraumBasispunkte, stoppBasispunkte, schrittMinuten, maximalMinutenJeTaetigkeit } =
    value as Partial<MehrarbeitEinstellungenInput>;
  if (typeof revision !== "string" || !/^\d+:\d+:\d+:\d+$/.test(revision)) {
    return { fehler: "revisionUngueltig" };
  }
  if (typeof spielraumBasispunkte !== "number" || !Number.isSafeInteger(spielraumBasispunkte)
    || spielraumBasispunkte < 0) return { fehler: "spielraumUngueltig" };
  if (typeof stoppBasispunkte !== "number" || !Number.isSafeInteger(stoppBasispunkte)
    || stoppBasispunkte <= spielraumBasispunkte || stoppBasispunkte > 10_000) return { fehler: "stoppUngueltig" };
  if (typeof schrittMinuten !== "number" || !Number.isSafeInteger(schrittMinuten) || schrittMinuten < 1
    || typeof maximalMinutenJeTaetigkeit !== "number" || !Number.isSafeInteger(maximalMinutenJeTaetigkeit)
    || maximalMinutenJeTaetigkeit < schrittMinuten || maximalMinutenJeTaetigkeit > 2_147_483_647
    || maximalMinutenJeTaetigkeit % schrittMinuten !== 0) return { fehler: "minutenUngueltig" };
  return { wert: { revision, spielraumBasispunkte, stoppBasispunkte, schrittMinuten, maximalMinutenJeTaetigkeit } };
}

export async function readMehrarbeitRegelInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const stand = await readMehrarbeitEinstellungen(tx, tenantId);
  if (!stand) return null;
  const { spielraumBasispunkte, stoppBasispunkte } = stand;
  if (!Number.isSafeInteger(spielraumBasispunkte) || !Number.isSafeInteger(stoppBasispunkte)
    || spielraumBasispunkte < 0 || stoppBasispunkte <= spielraumBasispunkte
    || stoppBasispunkte > 10_000) return null;
  return { revision: `mehrarbeit:${spielraumBasispunkte}:${stoppBasispunkte}`, spielraumBasispunkte, stoppBasispunkte };
}

export async function readMehrarbeitDauerInTransaction(tx: PrivilegedTenantTransaction, tenantId: string) {
  const stand = await readMehrarbeitEinstellungen(tx, tenantId);
  if (!stand) return null;
  const { schrittMinuten, maximalMinutenJeTaetigkeit } = stand;
  if (!Number.isSafeInteger(schrittMinuten) || !Number.isSafeInteger(maximalMinutenJeTaetigkeit)
    || schrittMinuten <= 0 || maximalMinutenJeTaetigkeit < schrittMinuten
    || maximalMinutenJeTaetigkeit % schrittMinuten !== 0) return null;
  return { schrittMinuten, maximalMinutenJeTaetigkeit };
}

type Mailfakten = Readonly<{
  auftrag: { orderNumber: string };
  rahmen: { freigegebeneGrenzeCent: number };
  gebuchteCent: number;
}>;

export async function readMehrarbeitKundenmailVorlageInTransaction(
  tx: PrivilegedTenantTransaction, auth: AuthorizationSnapshot,
) {
  if (!hasAuthorizationArea(auth, "mails") || !auth.permissions.includes("perm_view_prices")
    || !auth.permissions.includes("perm_view_leitstand")) return null;
  const einstellungen = await readMehrarbeitEinstellungen(tx, auth.tenantId);
  if (!einstellungen?.firma) return null;
  const zeilen = await tx.execute<{ id: string; subject: string; body: string | null; stand: string }>(sql`
    SELECT id::text, subject_template AS subject, body_text_template AS body, updated_at::text AS stand
    FROM public.v_eingang_email_template_settings_v1
    WHERE tenant_id=${auth.tenantId} AND template_key=${auth.tenantId + ":" + MEHRARBEIT_FREIGABE_VORLAGE}
    LIMIT 2
  `);
  const vorlage = zeilen.length === 1 ? zeilen[0] : null;
  if (!vorlage?.subject.trim() || !vorlage.body?.trim() || !vorlage.stand) return null;
  const { id, stand, subject, body } = vorlage;
  try {
    pruefeMehrarbeitVorlage(subject, body);
  } catch {
    return null;
  }
  const absender = [auth.displayName?.trim(), einstellungen.firma].filter(Boolean).join(" · ");
  return {
    revision: id + ":" + stand + ":" + absender,
    render(fakten: Mailfakten, begruendung: string) {
      const werte = {
        Auftragsnummer: fakten.auftrag.orderNumber,
        Betrag: formatEuro(fakten.gebuchteCent),
        Grenze: formatEuro(fakten.rahmen.freigegebeneGrenzeCent),
        Begründung: begruendung,
        Absender: absender,
      };
      return { subject: renderMehrarbeitVorlage(subject, werte), body: renderMehrarbeitVorlage(body, werte) };
    },
  };
}
