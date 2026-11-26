import type { LagerUnit } from "./quantity";

const kennung = /^[A-Za-z0-9_-]{1,128}$/u;
export const lagerBefehlsUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const einheiten: readonly LagerUnit[] = ["stk", "paar", "ml", "l", "g", "kg", "mm", "cm", "m"];
const gruende = {
  stock_in: ["wareneingang", "rueckgabe"],
  stock_out: ["entnahme", "rueckgabe"],
  consumption: ["verbrauch"],
  waste: ["schwund", "ausschuss"],
  move: ["badzugabe", "umlagerung"],
} as const satisfies Record<string, readonly string[]>;
const felder = new Set([
  "befehlId", "inventoryItemId", "movementType", "quantity", "einheit", "ortId", "fachzeit", "revision",
  "mengenqualitaet", "geschaeftsgrund", "orderId", "reason", "belegId", "originalDateiId", "kostenstelle",
  "werkstattOrtId", "zielOrtId", "imPreisEnthalten", "badProzessOrtId", "mehrarbeitBelegId",
]);

function passtText(wert: unknown, muster: RegExp): wert is string {
  return typeof wert === "string" && muster.test(wert);
}

export function istLagerRueckgabeZumAuftrag(input: unknown): boolean {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const { geschaeftsgrund, orderId } = input as Record<string, unknown>;
  return geschaeftsgrund === "rueckgabe" && passtText(orderId, kennung);
}

/** Liest ausschließlich den geschlossenen Eingabevertrag für B1a-3-Buchungen. */
export function leseLagerBuchungsauftrag(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const wert = input as Record<string, unknown>;
  if (Object.keys(wert).some((feld) => !felder.has(feld))) return null;

  const {
    befehlId, inventoryItemId, movementType, einheit, ortId, fachzeit, revision, mengenqualitaet, geschaeftsgrund,
    orderId, reason, belegId, originalDateiId, kostenstelle, werkstattOrtId, zielOrtId, imPreisEnthalten,
    badProzessOrtId, mehrarbeitBelegId,
  } = wert;
  if (!passtText(befehlId, lagerBefehlsUuid) || !passtText(inventoryItemId, kennung) || !passtText(ortId, lagerBefehlsUuid)
    || typeof einheit !== "string" || !einheiten.includes(einheit as LagerUnit)
    || !istLagerFachzeit(fachzeit)
    || typeof revision !== "number" || !Number.isInteger(revision) || revision < 1 || revision > 2147483647
    || mengenqualitaet !== "exakt" && mengenqualitaet !== "geschaetzt"
    || typeof movementType !== "string" || !Object.hasOwn(gruende, movementType)) return null;

  const art = movementType as keyof typeof gruende;
  if (typeof geschaeftsgrund !== "string" || !(gruende[art] as readonly string[]).includes(geschaeftsgrund)) return null;
  if (istLagerRueckgabeZumAuftrag(wert)) return null;
  if (orderId != null && !passtText(orderId, kennung)
    || belegId != null && !passtText(belegId, lagerBefehlsUuid)
    || originalDateiId != null && (!passtText(originalDateiId, lagerBefehlsUuid) || belegId == null)
    || kostenstelle != null && !passtText(kostenstelle, kennung)
    || reason != null && (typeof reason !== "string" || reason.length > 2000 || reason.includes("\u0000"))) return null;

  const werkstattEntnahme = orderId != null
    && (art === "consumption" || (art === "stock_out" && geschaeftsgrund === "entnahme"));
  const preisentscheidungNoetig = orderId != null && (werkstattEntnahme || art === "waste");
  if (werkstattOrtId != null && (!werkstattEntnahme || !passtText(werkstattOrtId, lagerBefehlsUuid) || werkstattOrtId === ortId)
    || (preisentscheidungNoetig ? typeof imPreisEnthalten !== "boolean" : imPreisEnthalten != null)) return null;
  if (mehrarbeitBelegId != null && (!passtText(mehrarbeitBelegId, kennung)
    || !werkstattEntnahme || typeof imPreisEnthalten !== "boolean")) return null;

  const umlagerung = art === "move" && geschaeftsgrund === "umlagerung";
  if (umlagerung
    ? !passtText(zielOrtId, lagerBefehlsUuid) || zielOrtId === ortId || orderId != null || badProzessOrtId != null
    : zielOrtId != null) return null;
  if (art === "move" && geschaeftsgrund === "badzugabe"
    ? !passtText(badProzessOrtId, lagerBefehlsUuid) || badProzessOrtId === ortId
    : badProzessOrtId != null) return null;

  const mengeText = typeof wert.quantity === "number" ? String(wert.quantity) : wert.quantity;
  const ganz = einheit === "stk" || einheit === "paar";
  if (!passtText(mengeText, ganz ? /^(?:0|[1-9]\d{0,10})$/u : /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/u)
    || !/[1-9]/u.test(mengeText)) return null;
  const quantity = mengeText.includes(".") ? mengeText.replace(/0+$/u, "").replace(/\.$/u, "") : mengeText;

  return {
    befehlId,
    inventoryItemId,
    movementType: art,
    quantity,
    einheit: einheit as LagerUnit,
    ortId,
    fachzeit,
    revision,
    mengenqualitaet,
    geschaeftsgrund,
    orderId: orderId ?? null,
    reason: reason ?? null,
    belegId: belegId ?? null,
    originalDateiId: originalDateiId ?? null,
    kostenstelle: kostenstelle ?? null,
    ...(typeof mehrarbeitBelegId === "string" ? { mehrarbeitBelegId } : {}),
    ...(typeof werkstattOrtId === "string" ? { werkstattOrtId } : {}),
    ...(typeof zielOrtId === "string" ? { zielOrtId } : {}),
    ...(typeof badProzessOrtId === "string" ? { badProzessOrtId } : {}),
    ...(typeof imPreisEnthalten === "boolean" ? { imPreisEnthalten } : {}),
  };
}

export type LagerBuchungsauftrag = NonNullable<ReturnType<typeof leseLagerBuchungsauftrag>>;

export function istLagerFachzeit(wert: unknown): wert is string {
  if (typeof wert !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(wert)) return false;
  const datum = new Date(wert);
  return Number.isFinite(datum.getTime()) && datum.toISOString() === wert && !wert.startsWith("0000");
}

export function leseLagerGegenbuchungsauftrag(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 3) return null;
  const { befehlId, ursprungId, fachzeit } = input as Record<string, unknown>;
  if (!passtText(befehlId, lagerBefehlsUuid) || !passtText(ursprungId, lagerBefehlsUuid) || !istLagerFachzeit(fachzeit)) return null;
  return { befehlId, ursprungId, fachzeit };
}
