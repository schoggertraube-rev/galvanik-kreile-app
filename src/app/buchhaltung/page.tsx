import {
  getCockpitMetricsAction,
  getSteuerprofilAction,
  listOffenePostenAction,
} from "@/app/buchhaltung/actions";
import { BuchhaltungCockpitClient } from "@/app/buchhaltung/BuchhaltungCockpitClient";

export const dynamic = "force-dynamic";

function currentMonth(now: Date): { von: string; bis: string; label: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const von = new Date(Date.UTC(year, month, 1)).toISOString().substring(0, 10);
  const bis = new Date(Date.UTC(year, month + 1, 0)).toISOString().substring(0, 10);
  return {
    von,
    bis,
    label: new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(now),
  };
}

export default async function BuchhaltungPage() {
  const generatedAt = new Date();
  const period = currentMonth(generatedAt);
  const [metrics, profile, openInvoices] = await Promise.all([
    getCockpitMetricsAction(period.von, period.bis),
    getSteuerprofilAction(),
    listOffenePostenAction(),
  ]);
  const today = generatedAt.toISOString().substring(0, 10);
  const overdueInvoices = openInvoices.filter((invoice) => (
    invoice.status === "ueberfaellig"
    || invoice.status === "gemahnt"
    || Boolean(invoice.faelligAm && invoice.faelligAm < today)
  ));

  return (
    <BuchhaltungCockpitClient
      snapshot={{
        period,
        generatedAt: generatedAt.toISOString(),
        ledger: profile.sachkontenrahmen,
        income: metrics.bwa.einnahmen,
        expenses: metrics.bwa.ausgaben,
        result: metrics.bwa.ergebnis,
        vatPayable: metrics.ustva.zahllast,
        receiptCount: metrics.belegCount,
        reviewCount: metrics.reviewCount,
        openInvoiceCount: openInvoices.length,
        overdueInvoiceCount: overdueInvoices.length,
        openAmount: openInvoices.reduce((sum, invoice) => sum + invoice.offenerBetrag, 0),
        categories: metrics.kategorien,
        truthStatus: metrics.dataQuality.truthStatus,
        missingInputCount: metrics.dataQuality.missingInputCount,
      }}
    />
  );
}
