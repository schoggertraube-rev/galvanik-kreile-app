import { invoiceExtraWorkCents } from "@/lib/domain/invoiceElectronicFields";

type Zeitposition = Readonly<{
  id: string;
  version: number;
  gebuchtAm: string;
  buchungsId: string;
  minuten: number;
  stundensatzCent: number;
}>;

type Mehrarbeitszusage = Mehrarbeitsfreigabe & { eventId: string };
export type Auftragsmehrarbeit = Readonly<{
  positionen: readonly (Zeitposition & { itemId: string; catalogPositionId: string })[];
  zusagen: readonly Mehrarbeitszusage[];
}>;

type AbgerechneteZeitposition = Readonly<{
  itemId: string;
  catalogPositionId: string;
  minutes: number;
  hourlyRateCents: number;
}>;

const minutenProStunde = BigInt(60);

function positionsbetrag(minuten: number, stundensatzCent: bigint): bigint {
  return BigInt(invoiceExtraWorkCents(minuten, Number(stundensatzCent)).fullCents);
}

function abgerundeterBetrag(minuten: number, stundensatzCent: bigint): bigint {
  return BigInt(invoiceExtraWorkCents(minuten, Number(stundensatzCent)).cappedCents);
}

function minutenImBudget(budgetCent: bigint, stundensatzCent: bigint, minuten: number): number {
  if (budgetCent === BigInt(0)) return 0;
  // Gesucht sind ganze Minuten, deren abgerundeter Betrag das Budget einhält.
  return Math.min(minuten, Number(((budgetCent + BigInt(1)) * minutenProStunde - BigInt(1)) / stundensatzCent));
}

function bestaetigteMinuten(
  buchungsfolge: readonly Zeitposition[],
  freigaben: readonly Mehrarbeitszusage[],
) {
  const minutenJePosition = new Map<string, { minuten: number; eventId: string }>();
  for (const freigabe of freigaben) {
    let budgetCent = BigInt(freigabe.approvedNetAmountCents);
    const versionJePosition = new Map(freigabe.positions.map(position => [position.lineId, position.lineVersion]));
    for (const position of buchungsfolge) {
      if (versionJePosition.get(position.id) !== position.version) continue;
      const rate = BigInt(position.stundensatzCent);
      const minuten = minutenImBudget(budgetCent, rate, position.minuten);
      budgetCent -= abgerundeterBetrag(minuten, rate);
      if (minuten > (minutenJePosition.get(position.id)?.minuten ?? 0)) {
        minutenJePosition.set(position.id, { minuten, eventId: freigabe.eventId });
      }
    }
  }
  return minutenJePosition;
}

export function verteileMehrarbeit<T extends Zeitposition>(
  positionen: readonly T[],
  grundNettoCent: number,
  spielraumBasispunkte: number,
  stoppBasispunkte: number,
  freigaben: readonly Mehrarbeitszusage[] = [],
) {
  const preisgrundlage = BigInt(grundNettoCent);
  const basispunkteProEinheit = BigInt(10_000);
  const spielraumCent = preisgrundlage * BigInt(spielraumBasispunkte) / basispunkteProEinheit;
  const stoppCent = preisgrundlage * BigInt(stoppBasispunkte) / basispunkteProEinheit;
  let gebuchterBetragCent = BigInt(0);
  const buchungsfolge = [...positionen].sort((links, rechts) =>
    links.gebuchtAm.localeCompare(rechts.gebuchtAm)
      || links.buchungsId.localeCompare(rechts.buchungsId)
  );
  const freigabeMinuten = bestaetigteMinuten(buchungsfolge, freigaben);
  const bestaetigterBetrag = buchungsfolge.reduce((summe, position) =>
    summe + abgerundeterBetrag(freigabeMinuten.get(position.id)?.minuten ?? 0, BigInt(position.stundensatzCent)),
  BigInt(0));
  let verfuegbarCent = spielraumCent > bestaetigterBetrag ? spielraumCent - bestaetigterBetrag : BigInt(0);

  const aufteilung = buchungsfolge.map(position => {
    const rate = BigInt(position.stundensatzCent);
    const zusage = freigabeMinuten.get(position.id);
    const bestaetigt = zusage?.minuten ?? 0;
    const vollerBetrag = positionsbetrag(position.minuten, rate);
    const unveraendert = bestaetigt === 0 && verfuegbarCent > BigInt(0) && vollerBetrag <= verfuegbarCent;
    const innerhalbSpielraum = unveraendert ? position.minuten
      : minutenImBudget(verfuegbarCent, rate, position.minuten - bestaetigt);
    const spielraumBetrag = unveraendert ? vollerBetrag : abgerundeterBetrag(innerhalbSpielraum, rate);
    const freigabeBetrag = abgerundeterBetrag(bestaetigt, rate);
    const minuten = bestaetigt + innerhalbSpielraum;
    gebuchterBetragCent += vollerBetrag;
    verfuegbarCent -= spielraumBetrag;

    const nichtAbgerechnetMinuten = position.minuten - minuten;
    return {
      position,
      ...(zusage ? { zusageEventId: zusage.eventId } : {}),
      ...(innerhalbSpielraum > 0 && !unveraendert ? { spielraumGekappt: true } : {}),
      bestaetigteMinuten: bestaetigt,
      bestaetigterBetragCent: Number(freigabeBetrag),
      abrechenbareMinuten: minuten,
      betragCent: Number(freigabeBetrag + spielraumBetrag),
      nichtAbgerechnetMinuten,
      nachkalkulationCent: Number(abgerundeterBetrag(nichtAbgerechnetMinuten, rate)),
    };
  });

  return {
    spielraumCent: Number(spielraumCent),
    stoppCent: Number(stoppCent),
    ueberStopp: gebuchterBetragCent > stoppCent,
    ueberSpielraum: aufteilung.some(position => position.nichtAbgerechnetMinuten > 0),
    positionen: aufteilung,
  };
}

export function berechneNichtBerechneteMehrarbeit(
  gebucht: Auftragsmehrarbeit["positionen"],
  abgerechnet: readonly AbgerechneteZeitposition[],
): { minuten: number; betragCent: number } {
  const positionsschluessel = ({ itemId, catalogPositionId }: Pick<AbgerechneteZeitposition, "itemId" | "catalogPositionId">) =>
    JSON.stringify([itemId, catalogPositionId]);
  const gebuchtePositionen = new Map(gebucht.map(position => [positionsschluessel(position), position]));
  if (gebuchtePositionen.size !== gebucht.length) throw Error("ORDER_EXTRA_WORK_SOURCE_AMBIGUOUS");

  const abgerechneteMinuten = new Map<string, number>();
  for (const zeile of abgerechnet) {
    const schluessel = positionsschluessel(zeile);
    const position = gebuchtePositionen.get(schluessel);
    const minuten = (abgerechneteMinuten.get(schluessel) ?? 0) + zeile.minutes;
    if (!position || zeile.hourlyRateCents !== position.stundensatzCent
      || !Number.isSafeInteger(zeile.minutes) || zeile.minutes < 1 || minuten > position.minuten) {
      throw Error("ORDER_EXTRA_WORK_INVOICE_SOURCE_INVALID");
    }
    abgerechneteMinuten.set(schluessel, minuten);
  }

  let minuten = 0;
  let betragCent = 0;
  for (const [schluessel, position] of gebuchtePositionen) {
    const rest = position.minuten - (abgerechneteMinuten.get(schluessel) ?? 0);
    minuten += rest;
    betragCent += invoiceExtraWorkCents(rest, position.stundensatzCent).cappedCents;
  }
  if (!Number.isSafeInteger(minuten) || !Number.isSafeInteger(betragCent)) {
    throw Error("ORDER_EXTRA_WORK_INVOICE_SOURCE_INVALID");
  }
  return { minuten, betragCent };
}

type FreigabePosition = Readonly<{ lineId: string; lineVersion: number }>;
type Mehrarbeitsfreigabe = Readonly<{
  approvedNetAmountCents: number;
  positions: readonly FreigabePosition[];
  approvedAt: string;
  approvedBy: string;
  confirmationText: string;
}> & (
  | { channel: "telefon"; intakeItemId?: never }
  | { channel: "mail"; intakeItemId: string }
);

export function freigabeDecktPosition(freigabe: Mehrarbeitsfreigabe, position: FreigabePosition): boolean {
  return freigabe.positions.some(belegt => belegt.lineId === position.lineId && belegt.lineVersion === position.lineVersion);
}

function istFreigabePosition(wert: unknown): wert is FreigabePosition {
  if (typeof wert !== "object" || wert === null || !("lineId" in wert) || !("lineVersion" in wert)) return false;
  return typeof wert.lineId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(wert.lineId)
    && typeof wert.lineVersion === "number" && Number.isInteger(wert.lineVersion)
    && wert.lineVersion > 0 && wert.lineVersion <= 2_147_483_647;
}

export function leseMehrarbeitsfreigabe(wert: unknown): Mehrarbeitsfreigabe | null {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) return null;
  const { approvedNetAmountCents, positions, channel, intakeItemId, approvedAt, approvedBy, confirmationText } = wert as Record<string, unknown>;
  if (typeof approvedNetAmountCents !== "number" || !Number.isSafeInteger(approvedNetAmountCents) || approvedNetAmountCents < 0
    || !Array.isArray(positions) || !positions.length || !positions.every(istFreigabePosition)
    || new Set(positions.map(position => position.lineId)).size !== positions.length
    || typeof approvedAt !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(approvedAt)
    || Number.isNaN(Date.parse(approvedAt)) || new Date(approvedAt).toISOString() !== approvedAt
    || typeof approvedBy !== "string" || !approvedBy.trim()
    || typeof confirmationText !== "string" || !confirmationText.trim()) return null;
  const belegdaten = { approvedNetAmountCents, positions, approvedAt, approvedBy, confirmationText };
  if (channel === "telefon" && intakeItemId === undefined) return { ...belegdaten, channel };
  if (channel === "mail" && typeof intakeItemId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(intakeItemId)) {
    return { ...belegdaten, channel, intakeItemId };
  }
  return null;
}
