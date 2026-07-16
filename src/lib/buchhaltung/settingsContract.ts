export const FINANCE_SETTINGS_ID = "default" as const;

export type FinanceLedger = "SKR03" | "SKR04";

export type FinanceSettingsInput = {
  standardKontenrahmen: FinanceLedger;
  ocrConfidenceSchwelle: number;
  beraterNr: string | null;
  mandantenNr: string | null;
};

export type OcrRuntimeStatus = {
  status: "configured" | "not_configured";
  provider: "Klippa" | "Gemini" | null;
  storageConfigured: boolean;
  usageAccountingConfigured: boolean;
};

export type FinanceSettingsSnapshot = FinanceSettingsInput & {
  profileId: string;
  persisted: boolean;
  editable: boolean;
  updatedAt: string | null;
  ocr: OcrRuntimeStatus;
};

export type FinanceSettingsReceipt = FinanceSettingsSnapshot & {
  auditId: string;
};

const IDENTIFIER = /^\d{1,20}$/;
const INPUT_KEYS = [
  "standardKontenrahmen",
  "ocrConfidenceSchwelle",
  "beraterNr",
  "mandantenNr",
] as const;

function identifier(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("INVALID_FINANCE_SETTINGS");
  const normalized = value.trim();
  if (!normalized) return null;
  if (!IDENTIFIER.test(normalized)) throw new Error("INVALID_FINANCE_SETTINGS");
  return normalized;
}

export function parseFinanceSettingsInput(value: unknown): FinanceSettingsInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_FINANCE_SETTINGS");
  }

  const input = value as Record<string, unknown>;
  const actualKeys = Object.keys(input);
  if (
    actualKeys.length !== INPUT_KEYS.length
    || actualKeys.some((key) => !INPUT_KEYS.includes(key as (typeof INPUT_KEYS)[number]))
  ) {
    throw new Error("INVALID_FINANCE_SETTINGS");
  }

  const ledger = input.standardKontenrahmen;
  if (ledger !== "SKR03" && ledger !== "SKR04") {
    throw new Error("INVALID_FINANCE_SETTINGS");
  }

  const confidence = input.ocrConfidenceSchwelle;
  if (
    typeof confidence !== "number"
    || !Number.isInteger(confidence)
    || confidence < 50
    || confidence > 99
  ) {
    throw new Error("INVALID_FINANCE_SETTINGS");
  }

  return {
    standardKontenrahmen: ledger,
    ocrConfidenceSchwelle: confidence,
    beraterNr: identifier(input.beraterNr),
    mandantenNr: identifier(input.mandantenNr),
  };
}

export function resolveOcrRuntimeStatus(
  environment: Readonly<Record<string, string | undefined>>,
): OcrRuntimeStatus {
  const storageConfigured = Boolean(
    (environment.SUPABASE_URL || environment.NEXT_PUBLIC_SUPABASE_URL)
    && environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  const provider = environment.KLIPPA_API_KEY
    ? "Klippa"
    : environment.GEMINI_API_KEY
      ? "Gemini"
      : null;
  const usageAccountingConfigured = Boolean(
    environment.AI_USAGE_HMAC_SECRET
    && new TextEncoder().encode(environment.AI_USAGE_HMAC_SECRET).byteLength >= 32,
  );

  return {
    status: provider
      && storageConfigured
      && (provider === "Klippa" || usageAccountingConfigured)
      ? "configured"
      : "not_configured",
    provider,
    storageConfigured,
    usageAccountingConfigured,
  };
}
