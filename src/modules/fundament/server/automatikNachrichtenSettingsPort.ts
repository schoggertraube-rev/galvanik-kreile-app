import "server-only";

import { sql } from "drizzle-orm";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { AUTOMATIK_NACHRICHTEN_TEXTE, type AutomatikNachrichtenArt } from "@/ui/automatikNachrichtenTexte";

type Takt = Readonly<{ art: "ereignis" | "fachfrist" }> | Readonly<{ art: "tage"; tage: number }>;
type Kanal = "email" | "brief" | "whatsapp" | "sms";
type Regel = Readonly<{
  aktiv: boolean;
  takt: Takt;
  textschluessel: AutomatikNachrichtenArt;
  kanal: Kanal;
  versandfenster: Readonly<{ von: string; bis: string }>;
}>;

type Zeile = {
  regel: unknown;
  auto_info: boolean | null;
  marketing_opt_out: boolean | null;
  kundentyp: string | null;
};

const objekt = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uhr = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const kanal = (value: unknown): value is Kanal =>
  value === "email" || value === "brief" || value === "whatsapp" || value === "sms";
const schluessel = (value: unknown): value is AutomatikNachrichtenArt =>
  typeof value === "string" && Object.hasOwn(AUTOMATIK_NACHRICHTEN_TEXTE, value);

function takt(value: unknown): Takt | null {
  if (!objekt(value)) return null;
  if ((value.art === "ereignis" || value.art === "fachfrist") && Object.keys(value).length === 1) {
    return { art: value.art };
  }
  if (value.art === "tage" && typeof value.tage === "number" && Number.isSafeInteger(value.tage) && value.tage >= 0) {
    return { art: "tage", tage: value.tage };
  }
  return null;
}

function leseRegel(value: unknown): Regel | null {
  if (!objekt(value)) return null;
  const { aktiv, textschluessel, versandfenster } = value;
  const lauf = takt(value.takt);
  if (typeof aktiv !== "boolean" || !lauf || !schluessel(textschluessel) || !kanal(value.kanal)
    || !objekt(versandfenster) || !uhr(versandfenster.von) || !uhr(versandfenster.bis)) return null;
  return { aktiv, textschluessel, versandfenster: { von:versandfenster.von, bis:versandfenster.bis },
    kanal:value.kanal, takt:lauf };
}

const berlin = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function istVersandzeit(fenster: Regel["versandfenster"], zeitpunkt: Date) {
  const jetzt = berlin.format(zeitpunkt);
  return fenster.von <= fenster.bis ? jetzt >= fenster.von && jetzt <= fenster.bis
    : jetzt >= fenster.von || jetzt <= fenster.bis;
}

/** Der Zeitauslöser liest diesen Stand vor dem vorhandenen Versand. */
export async function readAutomatikNachrichtInTransaction(
  tx: PrivilegedTenantTransaction,
  tenantId: string,
  art: AutomatikNachrichtenArt,
  empfaengerId: string,
  zeitpunkt: Date,
) {
  if (!schluessel(art) || !Number.isFinite(zeitpunkt.getTime())) return { code:"QUELLE_FEHLT" } as const;
  const rows = await tx.execute<Zeile>(sql`
    SELECT COALESCE(firma.automatik_nachrichten -> ${art},
      private.s16d_automatik_nachrichten_standardwerte() -> ${art}) AS regel,
      empfaenger.auto_info, empfaenger.marketing_opt_out, empfaenger.type AS kundentyp
    FROM (VALUES (1)) AS start(zeile)
    LEFT JOIN public.company_settings firma ON firma.tenant_id = ${tenantId}
    LEFT JOIN public.v_customers_settings_v1 empfaenger ON empfaenger.tenant_id = ${tenantId} AND empfaenger.id = ${empfaengerId}
    WHERE current_setting('app.tenant_id', true) = ${tenantId}
    LIMIT 2
  `);
  const regel = rows.length === 1 ? leseRegel(rows[0].regel) : null;
  if (!regel || !rows[0].kundentyp || (art === "sdb_anforderung") !== (rows[0].kundentyp === "lieferant")) {
    return { code:"QUELLE_FEHLT" } as const;
  }
  if (rows[0].auto_info !== true || (art === "bewertung" && rows[0].marketing_opt_out === true)) {
    return { code:"EMPFÄNGER_AUS", regel } as const;
  }
  if (!regel.aktiv) return { code:"REGEL_AUS", regel } as const;
  if (!istVersandzeit(regel.versandfenster, zeitpunkt)) return { code:"AUSSERHALB_VERSANDZEIT", regel } as const;
  return { code:"FREIGEGEBEN", regel } as const;
}

type AutomatikAuftrag = Readonly<{
  tenantId: string;
  art: AutomatikNachrichtenArt;
  empfaengerId: string;
  versandkennung: string;
}>;
type Auslassung = AutomatikAuftrag & Readonly<{ grund: "EMPFÄNGER_AUS" | "REGEL_AUS" }>;
type AuslassBeleg = Auslassung & Readonly<{ ereignisId: string }>;
type Protokoll = (tx: PrivilegedTenantTransaction, eintrag: Auslassung) => Promise<AuslassBeleg>;

/**
 * Für den vorhandenen S38b-Befehl. Der Protokoll-Port belegt die bewusst
 * ausgelassene Nachricht idempotent aus der Jobkennung. Ein Fenster außerhalb
 * lässt denselben Auftrag zur späteren Prüfung offen.
 */
export async function pruefeAutomatikNachrichtenAuftrag(
  tx: PrivilegedTenantTransaction, auftrag: AutomatikAuftrag, zeitpunkt: Date, protokoll: Protokoll,
) {
  if (!auftrag.versandkennung || auftrag.versandkennung !== auftrag.versandkennung.trim()) {
    return {code:"QUELLE_FEHLT"} as const;
  }
  const pruefung = await readAutomatikNachrichtInTransaction(
    tx, auftrag.tenantId, auftrag.art, auftrag.empfaengerId, zeitpunkt,
  );
  if (pruefung.code !== "EMPFÄNGER_AUS" && pruefung.code !== "REGEL_AUS") return pruefung;
  const grund = pruefung.code;
  const beleg = await protokoll(tx,{...auftrag,grund});
  if (!beleg?.ereignisId || beleg.tenantId !== auftrag.tenantId || beleg.art !== auftrag.art
    || beleg.empfaengerId !== auftrag.empfaengerId || beleg.versandkennung !== auftrag.versandkennung || beleg.grund !== grund) {
    throw Error("S16D_AUSLASSBELEG_NICHT_BESTAETIGT");
  }
  return {code:"AUSGELASSEN",grund,beleg} as const;
}
