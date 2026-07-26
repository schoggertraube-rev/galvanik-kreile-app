"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, DollarSign, TrendingUp } from "lucide-react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import {
  getAttributionData,
  type AttributionSnapshot,
  type ChannelAttribution,
} from "./actions";
import type { MarketingMetricState } from "@/lib/marketing/marketingTypes";

function countText(value: number | null, state: MarketingMetricState): string {
  if (value === null) return "Nicht vollständig erfasst";
  return state === "partial" ? `${value.toLocaleString("de-DE")} bekannt` : value.toLocaleString("de-DE");
}

function moneyText(value: number | null, state: MarketingMetricState, emptyLabel: string): string {
  if (state === "confirmed_empty") return emptyLabel;
  if (value === null) return "Nicht gemessen";
  return state === "partial"
    ? `${value.toLocaleString("de-DE")} € bekannter Teilbetrag`
    : `${value.toLocaleString("de-DE")} €`;
}

function budgetText(row: ChannelAttribution): string {
  if (row.budgetState === "confirmed_empty") return "0 € · keine Aktion";
  if (row.plannedBudget === null) return "Nicht erfasst";
  return row.budgetState === "partial"
    ? `${row.plannedBudget.toLocaleString("de-DE")} € bekannt`
    : `${row.plannedBudget.toLocaleString("de-DE")} €`;
}

export default function AttributionPage() {
  const [data, setData] = useState<AttributionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const retryAttribution = useCallback(() => {
    setLoading(true);
    setError(null);
    setData(null);
    getAttributionData()
      .then(setData)
      .catch(() => setError("Attributionsdaten konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    getAttributionData()
      .then((snapshot) => {
        if (active) setData(snapshot);
      })
      .catch(() => {
        if (active) setError("Attributionsdaten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Marketing", href: "/marketing" }, { label: "Attribution" }]} />
        <BackButton label="Marketing" href="/marketing" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Attribution & ROI</h1>
        <p className="text-slate-500">Gespeicherte Zuordnung: Touchpoint → Lead → Auftrag → Umsatz. Keine Echtzeit- oder Vollständigkeitsbehauptung.</p>
      </div>

      {loading && (
        <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Attributionsdaten werden geladen …
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-medium">{error}</p>
          <p className="mt-1 text-red-600">Es werden keine Nullwerte oder leeren Ergebnisse aus diesem Fehler abgeleitet.</p>
          <button
            type="button"
            onClick={retryAttribution}
            className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 font-medium hover:bg-red-100"
          >
            Erneut laden
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <Activity size={20} />
                <h3 className="font-medium">Eindeutig zugeordnete Leads</h3>
              </div>
              <div className="text-3xl font-bold">{countText(data.totals.leads, data.totals.leadState)}</div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <TrendingUp size={20} />
                <h3 className="font-medium">Eindeutig zugeordnete Aufträge</h3>
              </div>
              <div className="text-3xl font-bold">{countText(data.totals.auftraege, data.totals.orderState)}</div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 text-slate-500 mb-2">
                <DollarSign size={20} />
                <h3 className="font-medium">Zugeordneter Umsatz</h3>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {moneyText(data.totals.umsatz, data.totals.revenueState, "0 € · keine Zuordnung")}
              </div>
              {data.totals.revenueCoverage.missingCount > 0 && (
                <div className="mt-2 text-xs text-slate-500">
                  {data.totals.revenueCoverage.measuredCount}/{data.totals.revenueCoverage.sourceCount} Zuordnungen mit Umsatzbeleg
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                    <th className="p-4 font-medium">Kanal</th>
                    <th className="p-4 font-medium">Budget (Plan)</th>
                    <th className="p-4 font-medium">Ist-Ausgaben</th>
                    <th className="p-4 font-medium">Leads</th>
                    <th className="p-4 font-medium">Aufträge</th>
                    <th className="p-4 font-medium">Umsatz</th>
                    <th className="p-4 font-medium">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.channels.map((row) => (
                    <tr key={row.kanal} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-900">{row.kanal}</td>
                      <td className="p-4 text-slate-600">
                        {budgetText(row)}
                        {row.evidence.budgetCoverage.missingCount > 0 && (
                          <span className="block text-xs text-slate-500">
                            {row.evidence.budgetCoverage.measuredCount}/{row.evidence.budgetCoverage.sourceCount} Aktionen belegt
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500">
                        {row.actualSpend === null ? "Nicht angebunden" : `${row.actualSpend.toLocaleString("de-DE")} €`}
                      </td>
                      <td className="p-4 font-semibold text-blue-600">{countText(row.leads, row.leadState)}</td>
                      <td className="p-4 font-semibold text-indigo-600">{countText(row.auftraege, row.orderState)}</td>
                      <td className="p-4 font-semibold text-green-600">
                        {moneyText(row.umsatz, row.revenueState, "0 € · keine Zuordnung")}
                        {row.evidence.revenueCoverage.missingCount > 0 && (
                          <span className="block text-xs font-normal text-slate-500">
                            {row.evidence.revenueCoverage.measuredCount}/{row.evidence.revenueCoverage.sourceCount} belegt
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-400">Nicht berechenbar</td>
                    </tr>
                  ))}
                  {data.state === "confirmed_empty" && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Keine verifizierten Attributionsquellen vorhanden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
