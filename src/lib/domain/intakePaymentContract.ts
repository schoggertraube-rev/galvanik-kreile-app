export type PaymentMode='vorkasse'|'abholung'|'rechnung';

export function paymentModeFromPreference(
  preference: string | null | undefined,
  handoverMode: "pickup" | "shipping" = "shipping",
  terms?: { invoiceTermsEnabled?: boolean; invoiceTermDays?: number | null },
): PaymentMode {
  if (preference === "bar") return handoverMode === "pickup" ? "abholung" : "vorkasse";
  if (preference === "rechnung" && terms?.invoiceTermsEnabled && Number.isInteger(terms.invoiceTermDays) && Number(terms.invoiceTermDays) >= 1 && Number(terms.invoiceTermDays) <= 90) return "rechnung";
  return handoverMode === "pickup" && (!preference || preference === "rechnung") ? "abholung" : "vorkasse";
}

export function intakePaymentContract(input: {
  customerMode: "EXISTING" | "NEW";
  paymentPreference: string | null | undefined;
  handoverMode: "pickup" | "shipping";
  requestedMode?: PaymentMode;
  invoiceTermsEnabled?: boolean;
  invoiceTermDays?: number | null;
}): { ok: true; mode: PaymentMode } | { ok: false; message: string } {
  const mode = input.requestedMode
    ?? paymentModeFromPreference(input.paymentPreference, input.handoverMode, input);
  const targetEnabled = input.customerMode === "EXISTING"
    && input.paymentPreference === "rechnung" && input.invoiceTermsEnabled === true
    && Number.isInteger(input.invoiceTermDays) && Number(input.invoiceTermDays) >= 1 && Number(input.invoiceTermDays) <= 90;
  if (mode === "rechnung" && !targetEnabled) {
    return { ok: false, message: "Ziel nicht freigeschaltet." };
  }
  if (mode === "abholung" && input.handoverMode === "shipping") {
    return { ok: false, message: "Bar oder Karte nur bei Abholung." };
  }
  return { ok: true, mode };
}
