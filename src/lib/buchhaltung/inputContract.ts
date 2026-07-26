const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SKR_ACCOUNT = /^\d{1,9}$/;
const RECEIPT_TYPES = new Set(["rechnung", "kassenbon", "tankbeleg", "bewirtung", "abo"]);
const FUEL_TYPES = new Set(["diesel", "super", "superplus", "adblue", "unbekannt"]);
const CORRECTION_KEYS = new Set([
  "brutto",
  "netto",
  "ustBetrag",
  "ustSatz",
  "lieferantText",
  "lieferantId",
  "kategorieId",
  "belegart",
  "belegdatum",
  "rechnungsnummerExtern",
  "skrKonto",
  "absetzbarProzent",
  "absetzbarGrund",
  "vorsteuerAbzug",
]);

type RecordValue = Record<string, unknown>;

export type ReceiptCorrectionValues = Partial<{
  brutto: string;
  netto: string;
  ustBetrag: string;
  ustSatz: string;
  lieferantText: string;
  lieferantId: string;
  kategorieId: string;
  belegart: string;
  belegdatum: string;
  rechnungsnummerExtern: string | null;
  skrKonto: string | null;
  absetzbarProzent: string;
  absetzbarGrund: string | null;
  vorsteuerAbzug: boolean;
}>;

function record(value: unknown, error: string): RecordValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(error);
  return value as RecordValue;
}

export function parseFinanceUuid(value: unknown, field = "id"): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  return value.toLowerCase();
}

export function parseFinanceDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  return value;
}

function decimal(value: unknown, field: string, max: number, scale: number): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  }
  const factor = 10 ** scale;
  if (Math.abs(value * factor - Math.round(value * factor)) > 1e-7) {
    throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  }
  return value.toFixed(scale);
}

function text(value: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  const normalized = value.trim();
  if ((!allowEmpty && normalized.length === 0) || normalized.length > max || normalized.includes("\0")) {
    throw new Error(`FINANCE_INPUT_INVALID:${field}`);
  }
  return normalized;
}

export function parseReceiptCorrection(value: unknown): ReceiptCorrectionValues {
  const input = record(value, "FINANCE_INPUT_INVALID:correction");
  const keys = Object.keys(input);
  if (keys.length === 0 || keys.some((key) => !CORRECTION_KEYS.has(key))) {
    throw new Error("FINANCE_INPUT_INVALID:correction");
  }

  const result: ReceiptCorrectionValues = {};
  if ("brutto" in input) result.brutto = decimal(input.brutto, "brutto", 100_000_000, 2);
  if ("netto" in input) result.netto = decimal(input.netto, "netto", 100_000_000, 2);
  if ("ustBetrag" in input) result.ustBetrag = decimal(input.ustBetrag, "ustBetrag", 100_000_000, 2);
  if ("ustSatz" in input) result.ustSatz = decimal(input.ustSatz, "ustSatz", 100, 2);
  if ("lieferantText" in input) result.lieferantText = text(input.lieferantText, "lieferantText", 300);
  if ("lieferantId" in input) result.lieferantId = parseFinanceUuid(input.lieferantId, "lieferantId");
  if ("kategorieId" in input) result.kategorieId = parseFinanceUuid(input.kategorieId, "kategorieId");
  if ("belegart" in input) {
    const type = text(input.belegart, "belegart", 30);
    if (!RECEIPT_TYPES.has(type)) throw new Error("FINANCE_INPUT_INVALID:belegart");
    result.belegart = type;
  }
  if ("belegdatum" in input) result.belegdatum = parseFinanceDate(input.belegdatum, "belegdatum");
  if ("rechnungsnummerExtern" in input) {
    const number = text(input.rechnungsnummerExtern, "rechnungsnummerExtern", 100, true);
    result.rechnungsnummerExtern = number || null;
  }
  if ("skrKonto" in input) {
    const account = text(input.skrKonto, "skrKonto", 9, true);
    if (account && !SKR_ACCOUNT.test(account)) throw new Error("FINANCE_INPUT_INVALID:skrKonto");
    result.skrKonto = account || null;
  }
  if ("absetzbarProzent" in input) {
    result.absetzbarProzent = decimal(input.absetzbarProzent, "absetzbarProzent", 100, 2);
  }
  if ("absetzbarGrund" in input) {
    const reason = text(input.absetzbarGrund, "absetzbarGrund", 1_000, true);
    result.absetzbarGrund = reason || null;
  }
  if ("vorsteuerAbzug" in input) {
    if (typeof input.vorsteuerAbzug !== "boolean") throw new Error("FINANCE_INPUT_INVALID:vorsteuerAbzug");
    result.vorsteuerAbzug = input.vorsteuerAbzug;
  }
  return result;
}

export type FinalizableReceipt = {
  status: string;
  lieferantText: string | null;
  belegdatum: string | null;
  brutto: string | null;
  netto: string | null;
  ustSatz: string | null;
  ustBetrag: string | null;
  skrKonto: string | null;
  vorsteuerAbzug: boolean | null;
  absetzbarProzent: string | null;
};

export function assertFinalizableReceipt(value: FinalizableReceipt): void {
  if (value.status !== "erfasst") throw new Error("FINANCE_RECEIPT_REVIEW_REQUIRED");
  if (!value.lieferantText || value.lieferantText.trim().length === 0 || value.lieferantText.length > 300) {
    throw new Error("FINANCE_RECEIPT_INCOMPLETE:supplier");
  }
  parseFinanceDate(value.belegdatum, "belegdatum");
  if (!value.skrKonto || !SKR_ACCOUNT.test(value.skrKonto)) {
    throw new Error("FINANCE_RECEIPT_INCOMPLETE:account");
  }
  if (typeof value.vorsteuerAbzug !== "boolean") {
    throw new Error("FINANCE_RECEIPT_INCOMPLETE:input_tax_decision");
  }
  if (value.vorsteuerAbzug) {
    if (value.absetzbarProzent === null || value.absetzbarProzent.trim() === "") {
      throw new Error("FINANCE_RECEIPT_INCOMPLETE:deductible_percentage");
    }
    const deductiblePercentage = Number(value.absetzbarProzent);
    if (!Number.isFinite(deductiblePercentage) || deductiblePercentage < 0 || deductiblePercentage > 100) {
      throw new Error("FINANCE_RECEIPT_AMOUNTS_INCONSISTENT");
    }
  }
  const gross = Number(value.brutto);
  const net = Number(value.netto);
  const taxRate = Number(value.ustSatz);
  const tax = Number(value.ustBetrag);
  if (
    !Number.isFinite(gross) || gross <= 0
    || !Number.isFinite(net) || net < 0
    || value.ustSatz === null || value.ustSatz.trim() === '' || ![0, 7, 19].includes(taxRate)
    || !Number.isFinite(tax) || tax < 0
    || Math.abs(gross - net - tax) > 0.011
  ) throw new Error("FINANCE_RECEIPT_AMOUNTS_INCONSISTENT");
}

export function parseReceiptBatchAssignment(
  idsValue: unknown,
  updatesValue: unknown,
): { ids: string[]; updates: { kontoId?: string; kostenstelleId?: string } } {
  if (!Array.isArray(idsValue) || idsValue.length === 0 || idsValue.length > 100) {
    throw new Error("FINANCE_INPUT_INVALID:belegIds");
  }
  const ids = idsValue.map((id) => parseFinanceUuid(id, "belegIds"));
  if (new Set(ids).size !== ids.length) throw new Error("FINANCE_INPUT_INVALID:belegIds");

  const input = record(updatesValue, "FINANCE_INPUT_INVALID:assignment");
  const keys = Object.keys(input);
  if (
    keys.length === 0
    || keys.some((key) => key !== "kontoId" && key !== "kostenstelleId")
  ) throw new Error("FINANCE_INPUT_INVALID:assignment");
  const updates: { kontoId?: string; kostenstelleId?: string } = {};
  if ("kontoId" in input) updates.kontoId = parseFinanceUuid(input.kontoId, "kontoId");
  if ("kostenstelleId" in input) updates.kostenstelleId = parseFinanceUuid(input.kostenstelleId, "kostenstelleId");
  return { ids, updates };
}

export type FuelDetailInput = {
  sorte: "diesel" | "super" | "superplus" | "adblue" | "unbekannt";
  liter: string;
  preisProLiter: string | null;
  tankstelle: string | null;
  ort: string | null;
};

export function parseFuelDetailInput(value: unknown): FuelDetailInput {
  const input = record(value, "FINANCE_INPUT_INVALID:fuelDetail");
  const allowed = new Set(["sorte", "liter", "preisProLiter", "tankstelle", "ort"]);
  if (
    Object.keys(input).some((key) => !allowed.has(key))
    || !Object.hasOwn(input, "sorte")
    || !Object.hasOwn(input, "liter")
  ) {
    throw new Error("FINANCE_INPUT_INVALID:fuelDetail");
  }

  const sorte = text(input.sorte, "sorte", 20).toLowerCase();
  if (!FUEL_TYPES.has(sorte)) throw new Error("FINANCE_INPUT_INVALID:sorte");

  const liter = decimal(input.liter, "liter", 1_000_000, 2);
  if (Number(liter) <= 0) throw new Error("FINANCE_INPUT_INVALID:liter");

  let preisProLiter: string | null = null;
  if (input.preisProLiter !== null && input.preisProLiter !== undefined && input.preisProLiter !== "") {
    preisProLiter = decimal(input.preisProLiter, "preisProLiter", 1_000, 3);
    if (Number(preisProLiter) <= 0) throw new Error("FINANCE_INPUT_INVALID:preisProLiter");
  }

  const optionalInputText = (field: "tankstelle" | "ort", maximum: number) => {
    if (input[field] === null || input[field] === undefined || input[field] === "") return null;
    return text(input[field], field, maximum);
  };

  return {
    sorte: sorte as FuelDetailInput["sorte"],
    liter,
    preisProLiter,
    tankstelle: optionalInputText("tankstelle", 200),
    ort: optionalInputText("ort", 200),
  };
}

const COST_KEYS = new Set([
  "bezeichnung",
  "art",
  "kategorie",
  "betrag",
  "intervall",
  "belegId",
  "kampagneId",
  "giltAb",
  "giltBis",
]);

export type CostItemInput = {
  bezeichnung: string;
  art: "fix" | "variabel";
  kategorie: string | null;
  betrag: string;
  intervall: "einmalig" | "monatlich" | "jaehrlich";
  belegId: string | null;
  kampagneId: string | null;
  giltAb: string | null;
  giltBis: string | null;
};

export function parseCostItemFormData(formData: FormData): CostItemInput {
  const entries = [...formData.entries()];
  if (
    entries.length === 0
    || entries.some(([key, value]) => !COST_KEYS.has(key) || typeof value !== "string")
    || new Set(entries.map(([key]) => key)).size !== entries.length
  ) throw new Error("FINANCE_INPUT_INVALID:cost_item");
  const value = (key: string): string => {
    const entry = formData.get(key);
    return typeof entry === "string" ? entry : "";
  };

  const bezeichnung = text(value("bezeichnung"), "bezeichnung", 300);
  const art = value("art");
  if (art !== "fix" && art !== "variabel") throw new Error("FINANCE_INPUT_INVALID:art");
  const intervall = value("intervall");
  if (intervall !== "einmalig" && intervall !== "monatlich" && intervall !== "jaehrlich") {
    throw new Error("FINANCE_INPUT_INVALID:intervall");
  }
  const amountRaw = value("betrag").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountRaw)) throw new Error("FINANCE_INPUT_INVALID:betrag");
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    throw new Error("FINANCE_INPUT_INVALID:betrag");
  }
  const categoryRaw = value("kategorie");
  const kategorie = categoryRaw ? text(categoryRaw, "kategorie", 100) : null;
  const belegRaw = value("belegId");
  const kampagneRaw = value("kampagneId");
  const fromRaw = value("giltAb");
  const untilRaw = value("giltBis");
  const giltAb = fromRaw ? parseFinanceDate(fromRaw, "giltAb") : null;
  const giltBis = untilRaw ? parseFinanceDate(untilRaw, "giltBis") : null;
  if (giltAb && giltBis && giltBis < giltAb) throw new Error("FINANCE_INPUT_INVALID:cost_range");
  return {
    bezeichnung,
    art,
    kategorie,
    betrag: amount.toFixed(2),
    intervall,
    belegId: belegRaw ? parseFinanceUuid(belegRaw, "belegId") : null,
    kampagneId: kampagneRaw ? parseFinanceUuid(kampagneRaw, "kampagneId") : null,
    giltAb,
    giltBis,
  };
}
